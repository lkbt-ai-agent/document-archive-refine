---
created: 2026-06-23
updated: —
overview: 생성 LLM을 AWS Bedrock으로, OCR을 AWS에 별도 배포하고 임베딩만 로컬에 두는 분리 구조가 적합한지와 효율을 검토한다.
---

# AWS 오프로드 아키텍처 검토

맥 미니 단일 머신의 인제스트 병목을 풀기 위해 생성과 OCR을 AWS로 옮기고 임베딩만 로컬에 두는 구조가 실제 사례로 타당한지, 그리고 효율이 있는지 답한다.

---

## 1. 결론

- 제안 구조(생성=Bedrock, OCR=AWS 별도 배포, 임베딩=로컬)는 업계에서 검증된 정석 패턴이다.
- 지금 병목(lesson 04)에 효율적이다. 무거운 두 단계(OCR, 생성)가 맥 미니에서 빠져 타임아웃의 구조적 원인이 사라진다.
- 단 두 가지 제약을 지켜야 한다. AWS Textract는 한국어를 지원하지 않으므로 OCR은 PaddleOCR 셀프호스팅이어야 하고, A.X 4.0 Light는 Bedrock에 없으므로 생성 모델은 Claude나 Nova로 교체된다.
- 트레이드오프는 토큰 과금(OPEX), 모델 교체에 따른 동작 변화, 데이터 이그레스(외부 반출)다.

---

## 2. 문제 배경

처음 보는 사람을 위해 현재 구조와 병목을 먼저 푼다.

- 지금은 한 대(맥 미니 24GB)가 거의 모든 무거운 일을 한다. 인제스트 워커가 OCR로 글자를 뽑고(CPU), 생성 모델로 메타를 만들고(GPU), 임베딩 모델로 벡터를 만든다(GPU).
- 생성 모델과 임베딩 모델은 같은 GPU(Apple Metal) 하나를 나눠 쓴다.
- 큰 스캔 PDF 여러 개를 동시에 올리면 CPU(OCR)와 단일 GPU가 포화되고, 각 작업이 900초 잡 타임아웃을 넘겨 실패한다. 상세는 [lesson 04] 참고.
- 핵심은 한 대에 CPU 작업과 GPU 작업이 묶여 서로 자원을 빼앗는다는 점이다.

---

## 3. 제안 구조

- 생성 LLM을 AWS Bedrock(클라우드 API)으로 옮긴다.
- OCR을 AWS에 별도 서비스로 배포한다(셀프호스팅 PaddleOCR).
- 임베딩(KURE-v1)은 맥 미니에 그대로 둔다.
- 결과적으로 맥 미니 워커는 오케스트레이션과 임베딩만 맡는다.

---

## 4. 실제 사례로 적합한가

적합하다. 두 부분 모두 문서화된 패턴이다.

### 4.1 생성은 클라우드, 임베딩은 로컬 (하이브리드 RAG)

- AWS 자체가 하이브리드 RAG 구성을 권장한다. 임베딩 모델은 벡터 DB와 같이 두어 처리 효율과 데이터 지역성을 얻고, 생성은 클라우드 LLM으로 품질을 취한다.
- 이 프로젝트는 이미 이 방향으로 설계돼 있다. Provider 추상화가 로컬 llama.cpp와 Bedrock을 교체 가능하게 둔다(system-overview §3, "추후 Bedrock 교체").
- 임베딩을 로컬에 두는 선택은 한국어 품질(KURE)과 차원 lock-in 유지 측면에서 옳다.

### 4.2 OCR을 별도 서비스로 분리

- 문서 AI 마이크로서비스 논문이 정확히 우리 안티패턴을 지적한다. 인제스트와 OCR과 파싱을 한 워커에 두면 CPU 오케스트레이션이 GPU 또는 API 추론 용량에 묶인다.
- 권장 처방은 GPU 바운드 추론과 CPU 바운드 오케스트레이션의 분리다. 이는 lesson 04 병목의 직접 해법이다.
- 주의: AWS Textract는 영어, 독일어, 프랑스어, 스페인어, 이탈리아어, 포르투갈어만 지원하고 한국어를 지원하지 않는다. 따라서 "OCR을 AWS에 배포"는 Textract가 아니라 PaddleOCR를 GPU 인스턴스(SageMaker, ECS, EC2)에 셀프호스팅하는 형태여야 한다.
- 셀프호스팅 OCR은 한국어 지원에 더해 대규모에서 비용 우위가 있다(관리형 OCR API 대비 약 16배 저렴하다는 비교가 있다).

---

## 5. 효율 분석

지금 병목에 직접 듣는다.

- 생성을 Bedrock으로 옮기면 생성이 맥 미니 GPU에서 빠진다. 임베딩이 GPU를 독점한다.
- OCR을 AWS로 옮기면 CPU 무거운 단계가 워커에서 빠지고 수평 확장이 가능해진다.
- 임베딩만 로컬에 남으므로 맥 미니 워커가 가벼워진다.
- 결과적으로 lesson 04의 두 원인(단일 GPU 공유, OCR CPU 포화)이 함께 사라진다. 동시 처리 수(`max_jobs`)를 오히려 올릴 여지가 생긴다.

---

## 6. Bedrock 생성 모델, 가격, ID

A.X 4.0 Light(SKT 한국어 모델)는 Bedrock에 없다. 생성을 Bedrock으로 옮긴다는 것은 모델을 Claude나 Nova로 교체한다는 뜻이다.

| 모델 | Bedrock 모델 ID | 입력/출력 ($/1M 토큰) | 용도 적합성 |
| --- | --- | --- | --- |
| Claude Haiku 4.5 | `anthropic.claude-haiku-4-5` | 1 / 5 | 메타 추출, 대량 처리에 가성비 |
| Claude Sonnet 4.6 | `anthropic.claude-sonnet-4-6` | 3 / 15 | 한국어 RAG 답변 품질과 비용의 균형 |
| Claude Opus 4.8 | `anthropic.claude-opus-4-8` | 5 / 25 | 최고 품질, 비용 높음 |
| Amazon Nova Lite | (Amazon 계열) | 0.06 / 0.24 | 초저가, 한국어는 Claude보다 약함 |

ID와 리전 규칙:

- Bedrock 모델 ID에는 `anthropic.` 접두사가 붙는다(예: `anthropic.claude-sonnet-4-6`). 첫파티 ID를 그대로 쓰면 400 오류다.
- 리전은 필수다. 클라이언트 생성 시 `aws_region`을 지정한다. 전용 클라이언트 `AnthropicBedrockMantle`을 쓴다.
- 비용 절감: 배치 추론은 50퍼센트 절감, 프롬프트 캐싱은 반복 입력을 최대 90퍼센트 절감한다. 메타 추출처럼 같은 시스템 프롬프트를 반복하면 캐싱 효과가 크다.

권장 조합: 메타 추출은 Haiku 4.5, RAG 답변은 Sonnet 4.6이 한국어 품질과 비용 균형이 좋다.

---

## 7. 트레이드오프

- 토큰 과금(OPEX). 로컬 생성은 전기 외 무료지만 Bedrock은 토큰당 과금이다. 문서량과 RAG 호출량에 비례한다. 캐싱과 배치로 완화한다.
- 모델 교체에 따른 동작 변화. A.X에서 Claude로 바뀌면 품질은 오르지만 lineage와 프롬프트 튜닝이 필요하다. Provider 추상화 덕분에 코드 변경은 작다.
- OCR GPU 유휴 비용. 셀프호스팅 GPU 인스턴스는 시간당 과금이다. 버스트성 워크로드면 SageMaker async inference나 ECS scale to zero로 유휴 비용을 관리한다.
- 데이터 이그레스(외부 반출). 아래 7.1에서 자세히 푼다.

### 7.1 "Bedrock은 학습에 안 쓰는데 이그레스를 왜 고려하나"

- 이그레스는 데이터가 내 환경(맥 미니, 로컬망)을 떠나 외부 서비스(AWS)로 나가는 것 자체를 뜻한다.
- "학습에 안 쓴다"는 한 가지 위험(내 데이터가 모델 학습에 흡수되는 것)만 막는 약속이다. 데이터가 밖으로 나간다는 사실 자체는 그대로 남는다.
- 학습 외에 남는 고려 사항은 다음과 같다.
  - 법적 이슈. 문서가 AWS 리전(국외일 수 있음)에서 처리된다. 청약 공고는 개인정보(PII)를 담을 수 있어 개인정보의 국외 이전 규정이 걸릴 수 있다.
  - 처리 위탁과 전송 구간. 학습에 안 쓰더라도 전송 중과 처리 중에는 제3자(AWS) 인프라를 거친다. 일시적 로깅이나 캐시가 있을 수 있다.
  - 신뢰 경계 확장. 데이터를 만질 수 있는 주체가 늘어난다. 로컬 처리면 내 기기 안에 머문다.
  - 비용과 지연. 네트워크로 나가고 들어오는 데이터에 따른 비용과 지연이 생긴다.
- 요약. "학습 안 함"은 한 칸을 막는 것이고, "이그레스"는 데이터가 외부로 나가는 별개의 사실이다. 민감 문서라면 어디로(리전) 무엇이(원본 스캔인지 텍스트인지) 나가는지를 따로 따져야 한다.
- 이 구조에서 임베딩을 로컬에 둔 점은 이그레스의 일부를 줄인다. 다만 생성은 텍스트를, OCR은 원본 스캔 이미지를 밖으로 내보낸다.

---

## 8. 출처

- AWS, RAG with hybrid and edge services. https://aws.amazon.com/blogs/machine-learning/implement-rag-while-meeting-data-residency-requirements-using-aws-hybrid-and-edge-services/
- Operationalizing Document AI, Microservice Architecture for OCR and LLM Pipelines (arXiv). https://arxiv.org/html/2605.18818v1
- Amazon Textract FAQs (지원 언어). https://aws.amazon.com/textract/faqs/
- Top OCR Models 2025, Textract 대 PaddleOCR 언어와 비용. https://www.marktechpost.com/2025/11/02/comparing-the-top-6-ocr-optical-character-recognition-models-systems-in-2025/
- Amazon Bedrock Pricing. https://aws.amazon.com/bedrock/pricing/
- Bedrock 모델 ID, 리전, 클라이언트(`AnthropicBedrockMantle`, `anthropic.` 접두사): claude-api 스킬 레퍼런스.

---

## 9. 프로덕션 보안 고려

이 구조를 실제 서비스로 배포한다고 가정하면, 데이터 유출을 두 종류로 나눠 봐야 한다.

- 합법적 외부 반출은 우리가 데이터를 AWS에 맡겨 처리하는 것이다. Bedrock은 계약상 수탁자이고 학습에 쓰지 않으므로, 이것은 사고가 아니라 통제된 위탁이다.
- 사고로서의 유출은 권한 없는 사람이 데이터를 보게 되는 것이다. 프로덕션에서 진짜 위험한 쪽은 보통 이쪽이다.

### 9.1 합법적 반출이 만드는 의무

- 한국 개인정보보호법은 개인정보를 외부에 맡길 때 처리 위탁 사실을 알리도록 요구한다.
- 청약 공고처럼 개인정보가 든 문서가 국외 서버로 가면 국외 이전 동의나 고지가 필요할 수 있다.
- Bedrock 서울 리전(ap-northeast-2)을 쓰면 데이터가 국내에 머물러 국외 이전 문제를 상당 부분 피한다.

### 9.2 진짜 유출 위험은 클라우드가 아니라 구성 실수

- 대부분의 사고는 Bedrock 자체가 아니라 우리 쪽 설정에서 난다.
- 이 앱은 현재 인증이 없다. 고정 `SEED_USER_ID`로만 동작하므로, 프로덕션 전에 인증을 붙이는 것이 1순위다.
- 그 외 위험은 소유자(`owner_id`) 격리 부실, 스토리지 버킷 공개, presigned URL 유출, 로그에 본문이 쌓이는 것, OCR 서비스 노출이다.
- 즉 인증과 구성을 바로잡지 않으면 클라우드를 쓰지 않아도 유출이 난다.

### 9.3 이 하이브리드 구조가 유리한 점과 완화책

- 임베딩과 원본 보관을 로컬에 두므로, 가장 민감한 원본 자체는 밖으로 덜 나간다. 외부로 나가는 표면이 줄어든다.
- 생성에 보내기 전에 개인정보를 가린다(마스킹). Bedrock 프롬프트 로깅을 끄고 Guardrails로 개인정보를 거른다.
- 전송과 저장을 암호화하고, presigned URL의 유효 시간을 짧게 두며, 접근을 감사 로그로 남긴다.
