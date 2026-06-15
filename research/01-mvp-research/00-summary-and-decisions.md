---
created: 2026-06-09
updated: 2026-06-16
overview: Document Archive AI MVP의 핵심 설계 결정, 모델 3종 선정, 시스템 구성, 2주 일정을 요약한다.
---

# 00. 핵심 결정 요약, 모델 선정, 시스템 구성

requirement.md의 모든 TODO를 외부 설계, 구현 사례 조사로 해소한 2주 MVP 세부 설계 보고서다. 이 문서는 전체 요약이며 세부는 같은 폴더의 01~05 문서로 이어진다.

- 조사일 기준: 2026-06-09.
- 모든 권고는 다음 4가지를 1차 제약으로 두고 도출했다.
  1. 로컬 AI 런타임 = llama.cpp
  2. 한국어 문서/사용자
  3. 2주 개발 기간
  4. 로컬 배포 환경 = Mac mini(M4) + 24GB 통합 메모리. 추후 일부 모델은 AWS Bedrock 전환 가능.

## 0. 배포 환경 전제 (하드웨어, Provider)

requirement에 명시된 두 가지 전제를 모든 모델 및 메모리 결정의 기준으로 삼는다.

### 0.1 로컬 배포 대상: Mac mini (M4) + 24GB 통합 메모리

- Apple Silicon(M4) 환경에서 llama.cpp의 Metal 백엔드(애플 GPU 가속)로 모델을 돌린다.
- 일반 PC의 "그래픽 카드 전용 VRAM"이 아니라 통합 메모리(Unified Memory)다. CPU와 GPU가 24GB를 공유한다.
- 메모리 예산(24GB 기준, 대략):

  | 항목          | 모델                   | 양자화 | 대략 메모리 |
  | ------------- | ---------------------- | ------ | ----------- |
  | macOS + 앱    | -                      | -      | ~3–4 GB     |
  | 생성          | A.X 4.0 Light 7B       | Q4_K_M | ~4.9 GB     |
  | 임베딩        | KURE-v1                | Q8     | ~1 GB       |
  | KV 캐시, 여유 | -                      | -      | 가변        |

- 결론(architecture 확정): 로컬 AI 런타임은 llama-server 2 인스턴스만 상주한다(8080 생성, 8081 임베딩). OCR은 CPU 기반 PaddleOCR + Tesseract로 처리하며 추가 GPU 메모리를 쓰지 않는다.
- 권장 운용:
  - 생성(Q4_K_M) + 임베딩만 상시 상주한다.
  - OCR은 PaddleOCR/Tesseract가 CPU에서 돌므로 메모리 예산에 별도 VLM 항목이 없다.
  - 통합 메모리는 공유 자원이라 두 모델을 운용할 때도 KV 캐시와 OS 여유를 남긴다.
- 생성 모델 양자화는 §1.1 참고(생성+임베딩 동시 운용 시 Q4_K_M, 단독 상주 시 Q5_K_M).
- PaddleOCR/Tesseract는 CPU 기반이라 메모리를 거의 쓰지 않으므로 기본 OCR로 두기에 부담이 없다.
- VLM OCR(Qwen2.5-VL-7B + mmproj, ~6GB) 및 `llama-swap` 온디맨드 스왑 구상은 MVP 미채택(architecture 확정), 추후 검토. 채택 시 세 번째 인스턴스 상주/스왑과 메모리 충돌을 재평가해야 한다.

### 0.2 Provider 추상화: 로컬(llama.cpp)과 추후 AWS Bedrock

- requirement: "추후 일부 모델을 AWS Bedrock에 배포할 수도 있다."
- Provider = 모델을 어디서 실행하는지(로컬 llama.cpp인가, 클라우드 Bedrock API인가).
- MVP는 로컬(llama.cpp) 중심으로 간다.
- 백엔드에 Provider 추상화 인터페이스(예: `LLMClient` / `EmbeddingClient`)를 두어 호출부 변경 없이 Provider를 교체할 수 있게 설계한다. 상세는 [04-architecture.md](./04-architecture.md) §0.
- 무엇을 어디로 보낼지(권장):
  - **임베딩**: 로컬 고정 권장. Provider를 바꾸면 임베딩 차원과 의미 공간이 달라져 기존 벡터와 호환되지 않는다(전체 재임베딩 필요). KURE-v1(1024차원)을 그대로 유지.
  - **생성(LLM)**: 교체가 쉽다(단순 API 호출). 더 강한 한국어 품질이 필요하면 추후 생성만 Bedrock(예: Claude)로 전환 가능.
  - **OCR**: MVP는 로컬 PaddleOCR + Tesseract(CPU)로 확정. VLM 기반 OCR을 클라우드로 빼는 구상은 MVP 미채택, 추후 검토.
- 계보(Lineage)에 Provider 기록:
  - 모든 AI 산출물은 어떤 Provider와 모델로 만들었는지 저장한다([03-ai-outputs-and-lineage.md](./03-ai-outputs-and-lineage.md) §4 참고).
  - 로컬과 Bedrock을 섞어 써도 재현 및 감사가 가능하다.

---

## 1. 모델 3종 최종 선정 (requirement TODO 직접 해소)

requirement.md의 `Models` 섹션 3개 TODO(OCR / Embedding / Generation)에 대한 결론입니다.

### 1.1 Generation 모델: SKT A.X 4.0 Light 7B

| 후보                | 파라미터 | 한국어(KMMLU) | 라이선스    | 비고                                            |
| ------------------- | -------- | ------------- | ----------- | ----------------------------------------------- |
| A.X 4.0 Light       | 7B       | 64.15         | Apache 2.0  | Qwen2.5 기반 한국어 강화. MVP 선택              |
| EXAONE 3.5 7.8B     | 7.8B     | 53.76         | NC (비상업) | 한국어 chat(LogicKor 9.08)은 최고지만 상업 불가 |
| Qwen2.5-7B-Instruct | 7B       | 49.56         | Apache 2.0  | 한국어 특화 없음, 점수 낮음                     |
| Kanana-1.5-8B       | 8B       | 48.28         | (Kakao)     | -                                               |

- 결정적 발견:
  - LG EXAONE은 3.5/4.0 전 버전이 비상업(NC) 라이선스다. 한국어가 뛰어나지만 상업/기관 배포 시 별도 라이선스가 필요하다.
  - SKT A.X 4.0 Light는 Apache 2.0이면서 KMMLU와 CLIcK에서 EXAONE 3.5 7.8B를 상회한다. 라이선스 리스크 없이 동급 이상 한국어 성능.
- 양자화(중요, Mac 24GB 반영):
  - 품질만 보면 Q5_K_M(~5.5GB)이 이상적이다.
  - 단, Mac 24GB에서 생성+임베딩+OCR을 함께 운용하는 시나리오를 고려해 생성 모델은 Q4_K_M(~4.9GB)을 1차 권장한다(§0.1 참고).
  - OCR을 거의 안 쓰고 생성만 단독 상주한다면 Q5_K_M도 충분하다.
  - 7B 소형 모델은 양자화 민감도가 있어 Q4 미만(Q3 등)은 비권장.
- GGUF: 커뮤니티 빌드 `mykor/A.X-4.0-Light-gguf`.
- 확장 옵션(메모리 여유 시):
  - A.X 4.0 72B 또는 Qwen3-32B/Qwen2.5-32B (Q4_K_M ~17GB)로 한국어 품질 상향.
  - 단 24GB에선 32B 단독 상주만 현실적이고 임베딩 및 OCR과 동시 운용은 빠듯하다.
  - 더 큰 모델이 필요하면 생성만 AWS Bedrock으로 빼는 편이 낫다(§0.2 참고).

### 1.2 Embedding 모델: KURE-v1 (1024-dim)

| 후보                  | dim   | 최대 길이 | 한국어 순위(Ko-MTEB) | 라이선스   | GGUF                       |
| --------------------- | ----- | --------- | -------------------- | ---------- | -------------------------- |
| KURE-v1               | 1024  | 8192      | 1위 (NDCG 0.6055)    | MIT        | `Bingsu/KURE-v1-Q8_0-GGUF` |
| BAAI/bge-m3           | 1024  | 8192      | 3위 (0.5985)         | MIT        | `gpustack/bge-m3-GGUF`     |
| multilingual-e5-large | 1024  | 512       | 6위                  | MIT        | 있음                       |
| Qwen3-Embedding-0.6B  | ≤1024 | 32k       | (미검증)             | Apache 2.0 | 공식 GGUF                  |

- 결정: KURE-v1(고려대 NLP&AI, bge-m3 한국어 파인튜닝).
  - XLM-RoBERTa 백본이라 bge-m3와 동일하게 llama.cpp에서 동작(`--pooling cls`).
  - 대안은 bge-m3(제3자 검증 점수가 더 확실).
- 차원 1024로 전 시스템 통일. pgvector `vector(1024)`.
  - 리서치 중 일부 에이전트가 768을 placeholder로 썼으나, 선정 모델 기준 1024가 정답.
- 주의:
  - bge-m3의 sparse/ColBERT 멀티벡터는 llama.cpp가 dense만 지원(이슈 #14404).
  - sparse 키워드 검색은 PGroonga로 별도 처리한다([02 문서](./02-search-and-rag.md) 참고).

### 1.3 OCR 모델: PaddleOCR PP-OCRv5 + Tesseract

- 결론(architecture 확정): OCR 스택은 PaddleOCR PP-OCRv5(기본) + Tesseract `kor`(폴백) 2단 구성이다. VLM/Qwen2.5-VL은 MVP 채택 스택이 아니다.

| 계층 | 모델                        | 용도                           | 비고                                                                           |
| ---- | --------------------------- | ------------------------------ | ------------------------------------------------------------------------------ |
| 기본 | PaddleOCR PP-OCRv5(한국어)  | 이미지, 스캔 PDF 페이지        | Apache 2.0, 한국어 정확도/속도 균형 최상. v4는 한국어 rec 모델 없음, v5 사용   |
| 폴백 | Tesseract `kor`             | 단순/깨끗한 스캔               | Apache-2.0, 설치 간단하고 무마찰                                               |

- MVP 미채택(architecture 확정), 추후 검토: Qwen2.5-VL-7B GGUF + mmproj(복잡 레이아웃, 표, 혼합 페이지용 VLM).
  - llama.cpp 공식 지원. 한국어 OCR 7B≈78%(PM4Bench), 정밀 전사가 아닌 "이해" 수준.
  - 채택 시 세 번째 llama 인스턴스 또는 `llama-swap` 온디맨드 스왑이 필요하므로 메모리 예산(§0.1)을 재평가해야 한다.

- 제외:
  - GOT-OCR2.0: `GOTQwenForCausalLM` 아키텍처를 llama.cpp가 미지원, 로드 불가.
  - docTR: 한국어 모델 없음.
  - Llama 3.2 Vision: 한국어 약하고 무거움.

> 모델 선정의 상세 비교, 벤치마크, 출처는 [05-references.md](./05-references.md) 및 각 세부 문서 참조.

---

## 2. 시스템 구성도 (논리)

- 프론트엔드: Next.js 16 (RSC shell + Client 3-panel)
  - Left: 폴더트리
  - Center: 문서목록/상세/업로드
  - Right: 메타, AI이력
- 프론트엔드와 백엔드 연결: react-query (REST), presigned PUT/GET (MinIO 직접)
- 백엔드: FastAPI (async, SQLAlchemy 2, Pydantic v2)
  - 도메인: folders / documents / search / generations / storage
- 백엔드가 연결하는 컴포넌트:
  - arq worker (Redis): enqueue로 호출
  - PostgreSQL + pgvector + PGroonga: SQL
  - MinIO (S3): presign, 원본 파일 저장
  - llama.cpp (llama-server): HTTP, 2 인스턴스만 (architecture 확정)
    - :8080 생성(A.X 4.0 Light)
    - :8081 임베딩(KURE-v1)
    - OCR은 CPU 기반 PaddleOCR/Tesseract로 처리하므로 별도 llama 인스턴스 없음
- arq worker 역할:
  - 파이프라인: 추출, 메타, 청크, 임베딩
  - AI작업: 요약, 초안, 보고서

- llama.cpp 2 인스턴스 분리 (architecture 확정):
  - `--embeddings`는 임베딩 전용 모드라 생성 모델과 한 프로세스로 못 쓴다.
  - 포트 8080(생성)과 8081(임베딩) 분리. 로컬 AI 런타임은 이 2 인스턴스가 전부다.
  - OCR은 PaddleOCR/Tesseract(CPU)로 처리하므로 세 번째 llama 인스턴스나 `llama-swap`이 필요 없다. VLM 핫스왑 구상은 MVP 미채택, 추후 검토.
- 실행 위치(Mac 중요):
  - llama-server는 Mac 호스트에서 네이티브로 실행해야 Metal GPU 가속을 받는다.
  - Docker 컨테이너에 넣으면 Metal 접근이 안 돼 CPU-only로 느려진다.
  - 따라서 인프라(DB/MinIO/Redis)만 Docker, 모델은 호스트. 상세 [04 §6](./04-architecture.md).
- 메모리 예산(Mac 24GB 통합 메모리): 생성 + 임베딩만 상주, OCR은 CPU 기반 PaddleOCR/Tesseract. 상세 §0.1.

---

## 3. 데이터 처리 파이프라인 (업로드 후)

업로드 완료(confirm) 후 진행 순서:

1. status=processing
2. 파일타입 감지(magic bytes)
3. 텍스트 추출 (PDF/이미지/TXT/MD 분기, 페이지별 OCR 폴백)
4. 메타데이터 생성 (intrinsic + NLP + LLM 제목/요약/주제)
5. 구조 인식 청킹 (512토큰/64오버랩)
6. 임베딩 (KURE-v1), pgvector 저장
7. status=ready

- 각 stage는 멱등하고 재시작 가능.
- 실패 시 status=failed + error.

상세는 [01-document-processing.md](./01-document-processing.md).

---

## 4. Preview Release 범위 매핑

requirement의 Preview 완료 기준과 설계 문서:

| Preview 기능    | 설계 위치                            | 핵심 결정                           |
| --------------- | ------------------------------------ | ----------------------------------- |
| 폴더 CRUD       | [04](./04-architecture.md)           | 인접 리스트 + 재귀 CTE              |
| 문서 업로드     | [04](./04-architecture.md)           | presigned PUT 3단계                 |
| 텍스트 추출     | [01](./01-document-processing.md)    | pypdf(BSD) + pdfplumber + PaddleOCR |
| 메타데이터 생성 | [01](./01-document-processing.md)    | intrinsic+NLP+LLM                   |
| 임베딩 생성     | [01](./01-document-processing.md)    | KURE-v1 / 청킹 512                  |
| 키워드 검색     | [02](./02-search-and-rag.md)         | PGroonga TokenBigram                |
| 의미 검색       | [02](./02-search-and-rag.md)         | pgvector HNSW + 하이브리드 RRF      |
| RAG 답변        | [02](./02-search-and-rag.md)         | Advanced-lite, 인용 강제            |
| 문서 요약       | [03](./03-ai-outputs-and-lineage.md) | stuff, map-reduce 라우팅            |
| 문서 초안 생성  | [03](./03-ai-outputs-and-lineage.md) | outline-then-expand                 |
| 출처 추적       | [03](./03-ai-outputs-and-lineage.md) | `generation_source_chunks`          |
| 반응형 UI       | [04](./04-architecture.md)           | shadcn Resizable + 모바일 Sheet     |

---

## 5. 2주 개발 일정 (권장 순서)

### Week 1 - 기반 + 인제스트 + 검색

1. (D1-2) Docker Compose(pgvector/PGroonga/MinIO/Redis/llama×2), 백엔드 스캐폴드(도메인 모듈, async SA2, Alembic), 폴더/문서 스키마.
2. (D2-3) 폴더 CRUD(+MOVE 사이클 검증), 문서 업로드 presigned 3단계.
3. (D3-5) arq 파이프라인: 추출(pypdf/pdfplumber/PaddleOCR), 메타, 청킹, 임베딩(KURE-v1), pgvector.
4. (D5-6) 키워드(PGroonga) + 의미(pgvector) + 하이브리드 `hybrid_search()` SQL.

### Week 2 - RAG + AI 산출물 + UI

5. (D7-8) GBNF 쿼리 파싱(라우팅 + 폴더/날짜 필터)로 "작년 내 연봉" 류 동작. 인용 강제 RAG 답변.
6. (D8-9) `generations` 계보 스키마 + arq AI 작업. 요약(stuff/map-reduce) E2E.
7. (D9-10) 초안(outline-expand), 보고서 + Vega-Lite 차트(검증 루프).
8. (D10-12) Next.js 3-panel(트리/목록/메타, AI이력), react-query 폴링, 반응형.
9. (D12-13) ~50문항 골든셋 Recall@5/@20 평가, 필요 시에만 리랭커 토글.
10. (D13-14) 버그픽스, 통합, Preview 점검.

> 리랭킹, HyDE, 코드실행 차트, contextual retrieval은 MVP 이후로 의도적으로 후순위. 근거는 각 세부 문서의 "MVP 판정" 표 참조.
