---
created: 2026-06-09
updated: 2026-06-16
overview: 문서 인제스트 파이프라인(텍스트 추출, OCR, 메타데이터, 임베딩, 청킹)의 기술 선택과 근거를 정리한다.
---

# 01. 문서 처리 - 텍스트 추출, OCR, 메타데이터, 임베딩

requirement TODO 해소: 텍스트 추출 방식 / 메타데이터 생성 / 임베딩 방식.

---

## 1. 파일 타입 감지 (확장자 신뢰 금지)

- `filetype`(순수 파이썬, 시스템 의존 없음) 또는 `python-magic`(libmagic)으로 magic bytes 기반 MIME 판별 후 라우팅.
- magic bytes: 파일 맨 앞 몇 바이트에 들어 있는 고유 서명. 확장자가 거짓이어도 실제 형식을 알려줌.

> 왜?(초보자 설명) 사용자가 `.txt`로 이름만 바꾼 PDF를 올릴 수 있어 확장자는 신뢰할 수 없다. 파일 내용 앞부분(magic bytes)을 직접 보면 실제 형식을 정확히 알 수 있다.

| MIME                         | 경로                  |
| ---------------------------- | --------------------- |
| `application/pdf`            | PDF 경로              |
| `image/png\|jpeg\|webp`      | OCR 경로              |
| `text/plain`                 | TXT(인코딩 감지) 경로 |
| `text/markdown` (또는 `.md`) | Markdown 경로         |

---

## 2. 타입별 텍스트 추출

### 2.1 PDF - pypdf(BSD) + 페이지별 OCR 폴백

| 라이브러리              | 속도                | 레이아웃         | 표                  | 한국어(네이티브) | 라이선스   | 판정                                            |
| ----------------------- | ------------------- | ---------------- | ------------------- | ---------------- | ---------- | ----------------------------------------------- |
| pypdf                   | 빠름                | 약함             | 약함                | 보통(유니코드)   | BSD        | 기본 추출기(라이선스 안전)                      |
| pdfplumber              | ~0.1s/p             | 좌표/디버그      | 규칙기반 표 최강    | 양호             | MIT        | 표, 레이아웃 보조(권장 병용)                    |
| PyMuPDF / `pymupdf4llm` | 최속(~0.01–0.12s/p) | 양호, MD 출력    | `find_tables()`     | 우수(유니코드)   | AGPL-3.0   | 라이선스 회피로 제외(상업 라이선스 구매 시에만) |
| Docling(IBM)            | 0.3–3s/p            | ML 레이아웃      | 표 최강(TEDS 0.887) | 양호             | MIT        | phase-2 품질 업그레이드                         |
| Marker                  | 5–11s/p(CPU)        | 우수(PDF를 MD로) | 양호                | Surya 기반       | GPL성/상업 | 무거움, MVP 제외                                |

- 결정(라이선스 우선): `pypdf`(BSD)를 기본 텍스트 추출기로 쓴다.
- 표/복잡 레이아웃 페이지는 `pdfplumber`(MIT)로 보강한다.
- 둘 다 배포 제약이 없는 허용형(permissive) 라이선스라 외부 서비스 배포에 안전하다.

#### 왜 PyMuPDF를 빼는가

- PyMuPDF/`pymupdf4llm`는 가장 빠르고 품질도 좋지만 AGPL-3.0이다.
- 네트워크 서비스로 배포하면 전체 서버 소스 공개 의무가 발생할 수 있다.
- 상업/비공개 배포 계획이 있으면 리스크가 크다.
- Artifex 상업 라이선스를 구매하지 않는 한 기본 스택에서 제외한다.

#### 트레이드오프(인지하고 보완)

- PyMuPDF가 주던 Markdown 직접 출력이 없다. pypdf는 평문 텍스트를 내므로 구조 보존은 다음으로 보완한다.
  - (a) pdfplumber로 표를 Markdown 표로 직렬화.
  - (b) 청킹을 재귀 분할(§5.2)로 처리.
  - 헤딩 계층 추정이 약해지는 점은 감수.
- pypdf는 페이지를 이미지로 렌더(래스터화)하지 못한다. 스캔/이미지 PDF의 OCR 입력이 필요할 때:
  - `page.images`로 임베드된 이미지를 추출.
  - 풀페이지 래스터가 필요하면 `pdf2image`(Poppler)로 렌더해 OCR(§3)에 넘김. (Poppler는 별도 프로세스 호출이라 라이선스 결합 이슈 없음.)
- 속도는 PyMuPDF보다 느리지만 인제스트는 비동기 백그라운드(§6)라 사용자 체감에 무관.

#### 스캔/이미지 PDF 판별 (페이지 단위)

혼합 PDF가 흔하므로 페이지별로 판정:

1. `len(page.extract_text().strip()) < THRESHOLD`(≈20–50자)이면 OCR 후보(pypdf).
2. `page.images`가 있고 추출 텍스트가 거의 없으면 스캔 페이지로 강한 신호.
3. 추출 텍스트가 공백/깨진 글자뿐이면 이미 래스터화된 스캔으로 간주.

> 왜?(초보자 설명) 한 PDF 안에 디지털 텍스트 페이지와 스캔 이미지 페이지가 섞여 있는 경우가 흔하다. 그래서 문서 전체가 아니라 페이지마다 OCR이 필요한지 따로 판정한다(필요 없는 페이지에 OCR을 돌리면 느리고 품질도 나빠짐).

- `List[(page_no, needs_ocr)]` 반환해 혼합 문서 처리. OCR 대상 페이지의 이미지를 얻는 방법은 위 트레이드오프(`page.images` / `pdf2image`)와 같다.

### 2.2 이미지(PNG/JPG/JPEG/WEBP) - OCR 경로 (§3)

### 2.3 TXT - 인코딩 감지 (한국어 핵심: CP949/EUC-KR)

| 라이브러리         | 한국어 인코딩                            | 비고                       |
| ------------------ | ---------------------------------------- | -------------------------- |
| charset-normalizer | EUC-KR/CP949 양호                        | MIT, `requests` 기본. 권장 |
| chardet            | EUC-KR(단 UHC/CP949 라벨 부재 이슈 #164) | LGPL                       |
| cchardet           | UHC/CP949 정확하나 최신 파이썬 미지원    | 회피                       |

핵심 함정:

- CP949(=UHC)는 EUC-KR의 상위집합(+한글 8천자).
- 감지기가 "EUC-KR"로 답해도 CP949로 디코딩하면 안전(상위집합).

권장 로직:

```python
def decode_text(b: bytes) -> str:
    for enc in ("utf-8-sig", "utf-8"):
        try: return b.decode(enc)
        except UnicodeDecodeError: pass
    guess = charset_normalizer.from_bytes(b).best()
    enc = str(guess.encoding) if guess else "cp949"
    if enc.lower() in ("euc_kr", "euc-kr", "ks_c_5601"):
        enc = "cp949"                 # 상위집합으로 안전 디코딩
    try: return b.decode(enc)
    except Exception: return b.decode("cp949", errors="replace")  # 절대 크래시 금지
```

### 2.4 Markdown - 구조 보존 (평문화 금지)

- MD를 평문으로 깎지 말 것. 헤딩/리스트/코드펜스/표는 가장 신뢰도 높은 청크 경계다.
- LangChain `MarkdownHeaderTextSplitter`로 헤딩 계층을 청크 메타데이터에 실어 보존.

---

## 3. OCR (한국어)

- 결론(architecture 확정): MVP OCR은 CPU 전통 엔진만 쓴다. PaddleOCR PP-OCRv5(기본) + Tesseract `kor`(폴백).
- VLM(Qwen2.5-VL 등) OCR 경로는 MVP 미채택(추후 검토). 조사 기록은 §3.2에 보존.

> 아래는 두 갈래(전통 엔진 / VLM)를 모두 조사한 기록이다. MVP 채택은 전통 엔진 한정이며, VLM은 추후 검토 대상으로만 남긴다.

- CPU에서 도는 전통 엔진: 가볍고 빠름, MVP 채택.
- AI 모델(VLM)을 쓰는 방식: 무겁지만 어려운 레이아웃에 강함. MVP 미채택(추후 검토).

> 왜?(초보자 설명) 대부분의 페이지는 전통 OCR이면 충분하고 메모리도 거의 안 쓴다. VLM은 표, 복잡한 레이아웃 같은 어려운 페이지에 강하지만 MVP에서는 쓰지 않는다(아래 §3.2의 메모리 주의 참고).

### 3.1 전통 엔진

| 엔진               | 한국어       | 정확도           | 속도      | 배포            | 라이선스   | 판정                            |
| ------------------ | ------------ | ---------------- | --------- | --------------- | ---------- | ------------------------------- |
| PaddleOCR PP-OCRv5 | O(v5부터)    | 높음             | 빠름      | 중(Paddle 의존) | Apache-2.0 | 기본                            |
| Tesseract `kor`    | O(성숙)      | 깨끗한 스캔 양호 | 빠름(CPU) | 최易            | Apache-2.0 | 무마찰 폴백                     |
| EasyOCR            | O            | GPU시 양호       | CPU 느림  | 易              | Apache-2.0 | 대안                            |
| Surya              | O(90+)       | 높음(레이아웃)   | GPU 빠름  | 확인要          | 확인要     | GPU시 강력(Marker/Docling 기반) |
| docTR              | X(라틴 중심) | -                | -         | -               | -          | 한국어 제외                     |

### 3.2 VLM OCR (llama.cpp에서 직접 - 런타임 재사용) - MVP 미채택(architecture 확정), 추후 검토

- 이 절 전체는 MVP 미채택 경로다. architecture가 OCR을 전통 엔진(PaddleOCR + Tesseract)으로 확정했다. 아래는 추후 검토를 위한 조사 기록으로만 보존한다.
- VLM을 OCR에 쓰는 방식.
- llama.cpp에서 돌리려면 모델 본체(GGUF)와 함께 mmproj(이미지를 토큰으로 바꿔주는 보조 파일)가 필요하다.

llama.cpp `docs/multimodal.md` 공식 확인 기준:

| 모델             | llama.cpp        | GGUF+mmproj                            | 한국어 OCR                     | 판정            |
| ---------------- | ---------------- | -------------------------------------- | ------------------------------ | --------------- |
| Qwen2.5-VL-7B    | 공식 지원        | `ggml-org/Qwen2.5-VL-7B-Instruct-GGUF` | 7B≈77.6% / 72B≈94.8%(PM4Bench) | VLM 픽          |
| Qwen2-VL         | 공식 지원        | 있음                                   | 양호                           | 2.5가 우위      |
| MiniCPM-V 2.6    | 지원             | 있음                                   | 양호                           | 대안            |
| GOT-OCR2.0       | 미지원(아키텍처) | -                                      | 강함                           | 로드 불가, 제외 |
| Llama 3.2 Vision | 불안정, 무거움   | 일부                                   | 약함                           | 제외            |

실행 예:

```bash
llama-server -hf ggml-org/Qwen2.5-VL-7B-Instruct-GGUF   # /v1/chat/completions 로 이미지+프롬프트
```

> 로컬 하드웨어(메모리) 주의 - Mac mini(M4) / 24GB 통합 메모리.
>
> - 로컬 배포 대상은 Mac mini(M4 칩) + 24GB 통합 메모리(Unified Memory)이며, llama.cpp는 Metal(애플 GPU 가속) 백엔드로 돈다.
> - 일반 PC의 그래픽 카드 전용 메모리(VRAM)가 아니라 CPU, GPU가 같은 메모리를 공유하는 구조라, 한 모델이 메모리를 점유하면 그만큼 다른 모델 몫이 줄어든다.
> - macOS가 ~3~4GB를 먼저 쓰므로 모델에 쓸 수 있는 실제 예산은 24GB보다 작다.
> - OCR용 VLM(Qwen2.5-VL-7B Q4 ~6GB + mmproj)은 상주시키지 말고 필요할 때만 로드(예: `llama-swap`으로 on-demand 스왑)한다. 생성 모델, 임베딩 모델과 메모리를 나눠 쓰는 부담을 피하기 위함이다. 메모리가 공유 자원이라 세 모델을 동시에 올리려 하면 압박이 크다.
> - 기본 OCR(PaddleOCR / Tesseract, CPU)은 메모리를 거의 안 쓰므로 항상 켜 두는 기본값이다(MVP 채택). VLM을 추후 도입한다면 어려운 페이지에만 on-demand로 꺼내 쓰는 형태가 될 것이다(MVP 미채택).

> 제공자(Provider) 노트(선택).
>
> - 향후 무거운 OCR은 AWS Bedrock에서 돌리도록 Provider 추상화를 통해 전환할 수 있다.
> - 다만 로컬 PaddleOCR/Tesseract가 MVP 기본값이며, 추상화 구조 자체는 [04-architecture.md](./04-architecture.md)가 다룬다.

### 3.3 OCR 권고 (MVP)

- 결정(architecture 확정): PaddleOCR PP-OCRv5(한국어) 기본 + Tesseract `kor` 폴백만 쓴다.
- 폴백 트리거: PaddleOCR이 실패하거나 품질이 낮은 페이지를 Tesseract `kor`로 재처리.
- Qwen2.5-VL-7B 선택 적용은 MVP 미채택(추후 검토). 아래는 추후 검토용 참고 기록이다.
  - 7B 한국어≈78%는 "이해" 수준이지 완벽 전사가 아님. 고정밀이 필요한 32B/72B급은 24GB 로컬에 부담이라 향후 AWS Bedrock 등 클라우드 Provider로 위임 고려.
  - 도입 시 24GB 통합 메모리에서는 상주가 아니라 on-demand 로드(§3.2)로 써야 한다.

> PM4Bench 한국어 수치(77.6/94.8)는 단일 출처(검색 요약)라 인용 전 재확인 권장.

---

## 4. 메타데이터 생성

DMS 관행에 따라 시스템(불변) / 기술-의미(생성, 편집가능)로 구분 저장.

| 범주      | 필드                                                        | 소스                               |
| --------- | ----------------------------------------------------------- | ---------------------------------- |
| 파일      | `size_bytes`, `mime_type`, `sha256`, `original_filename`    | 업로드/`stat_object`, 추출 중 해시 |
| 내재      | `page_count`, `author`, `doc_created_at`, `doc_modified_at` | PDF/Office 메타(pypdf/Tika)        |
| 파생(NLP) | `language`(한국어=`ko`), `keywords[]`, `word_count`         | 언어감지/키워드추출                |
| LLM 생성  | `llm_title`, `llm_summary`, `topics[]`, 자동 태그           | A.X 4.0 Light에 추출 텍스트 투입   |
| 의미      | 청크별 `embedding`(글 의미를 담은 숫자 벡터)                | KURE-v1, pgvector                  |

- LLM 메타 추출은 `--json-schema`(GBNF) 제약 디코딩으로 항상 유효 JSON 보장:
  ```jsonc
  { "title": str, "summary": str, "topics": [str], "keywords": [str],
    "doc_type": str, "language": "ko" }
  ```
  한국어 필드 설명 + 1-shot 한국어 예시를 프롬프트에 넣어 날짜/숫자 포맷 안정화.
- LLM 생성값은 사용자 편집 가능, 생성 이력은 `ai_generations`에 보존(우측 패널 "AI 생성 이력 요약").
- 스키마는 [04-architecture.md](./04-architecture.md) §4b 참조.

---

## 5. 임베딩 & 청킹

임베딩과 청킹은 의미 검색의 토대다.

> 왜?(초보자 설명) 사람은 "연봉"과 "급여"가 같은 뜻임을 안다. 임베딩은 이 의미를 숫자 벡터로 바꿔, 글자가 달라도 의미가 가까우면 벡터도 가깝게 만든다. 그 덕에 키워드가 안 겹쳐도 의미로 문서를 찾을 수 있다.

### 5.1 임베딩 모델 - KURE-v1 ([00 문서](./00-summary-and-decisions.md) §1.2)

- 1024-dim(차원=벡터를 이루는 숫자 개수), 8192 ctx, MIT, GGUF(`Bingsu/KURE-v1-Q8_0-GGUF`; `Q8_0`은 양자화=모델을 더 가볍게 압축한 수준).
- llama-server 임베딩 모드:
  ```bash
  llama-server -m KURE-v1-Q8_0.gguf --embeddings --pooling cls \
    --ctx-size 8192 --batch-size 8192 --ubatch-size 8192 -ngl 99
  ```
- 함정:
  - 풀링(여러 토큰 벡터를 한 문장 벡터로 합치는 방식)이 틀리면 결과가 무의미해진다. bge-m3/KURE는 `cls`를 쓴다(e5=mean, Qwen3=last).
    - 왜?(초보자 설명) 모델마다 학습 때 정해진 합치는 방식이 있어, 다른 방식을 쓰면 의미가 깨진 벡터가 나온다.
  - `batch ≥ ctx` 위반 시 assert 크래시. `--batch-size`, `--ctx-size` 명시.
  - `/v1/embeddings`가 이미 L2 정규화. cosine/내적 사용, 이중 정규화 금지.

### 5.2 청킹 전략

| 전략                     | 한국어 적합     | 비고                                              |
| ------------------------ | --------------- | ------------------------------------------------- |
| 재귀 분할(Recursive)     | 기본 권장       | CJK 인지 구분자, 단락/문장/단어                   |
| 고정 토큰                | OK(오버랩 필요) | 단순                                              |
| 의미(semantic)           | 위험            | 조각 과소화(평균 43토큰, 정확도 -15pt)라 MVP 보류 |
| 구조 인식(MD헤더/페이지) | 강함            | 아카이브 문서에 유리                              |

- 권장값: 512토큰(토큰=AI가 글자를 처리하는 최소 단위) / 64(12%) 오버랩. bge-m3/KURE 학습 분포에 부합, 8192 한참 아래.
  - 왜?(초보자 설명) 오버랩은 조각을 자를 때 경계에서 문맥이 끊기지 않게 앞 조각의 끝부분을 다음 조각 앞에 약간 겹쳐 넣는 것이다. 그래야 문장 중간에서 잘려도 의미가 보존된다.
- 한국어 주의: 교착어라 한글 1자 ≈ XLM-R 서브워드 1.5–3토큰. "512토큰"은 영어보다 적은 한글 수다. 문자 수가 아니라 실제 모델 토크나이저로 측정.
- 라이브러리: LangChain `RecursiveCharacterTextSplitter`/`MarkdownHeaderTextSplitter`(기본), Chonkie(56개국어, 추후 semantic), unstructured(PDF/DOCX 구조 파싱).

### 5.3 무엇을 임베딩할까 - 청크 본문 (contextual prefix는 MVP 미적용)

- 결정(architecture 확정): 청크 본문 + 임베딩 + 메타데이터를 행 단위로 pgvector 저장. `parent_doc_id`로 주변 컨텍스트 반환(간이 parent-document retriever). Contextual prefix는 쓰지 않는다.
- Contextual Retrieval(맥락 보강 검색): MVP 미적용(architecture 확정), 추후 검토.
  - 미적용 사유: 청크마다 LLM 호출이 추가돼 로컬 추론 인제스트 비용이 큼. 검색 품질이 부족하다고 측정되면 도입 검토.
  - 기법: 청크 임베딩 전에 "이 청크가 문서 어디에 속하는지" 한 줄 컨텍스트를 로컬 LLM으로 생성해 prepend(조각 앞에 붙임).
  - 벤치마크(참고 보존): Anthropic 보고 기준 top-20 검색 실패율 5.7%에서 2.9%로(-49%).
  - 로컬 LLM 사용 시 API 비용은 0이나, 청크당 추론 시간 비용이 인제스트에 누적됨.
- 표: Markdown 표로 직렬화해 원자 단위로 임베딩(행 중간 분할 금지, 헤더 행 반복). 사례상 RAG 정확도 ~20% 개선.

### 5.4 pgvector 스키마/인덱스

pgvector에 청크별 임베딩을 저장하고, HNSW로 색인한다.

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE document_chunks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  parent_doc_id UUID,
  chunk_index   INT NOT NULL,
  content       TEXT NOT NULL,        -- 청크 본문 저장(필수)
  metadata      JSONB,                -- {page, lang, section, tags...}
  embedding     vector(1024) NOT NULL,
  UNIQUE (document_id, chunk_index)
);
CREATE INDEX ON document_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 200);
CREATE INDEX ON document_chunks USING gin (metadata);
```

- HNSW > IVFFlat(RAG 기본): 더 나은 속도/재현율, 학습 단계 불필요.
  - 왜?(초보자 설명) 벡터 수가 많으면 전부 일일이 비교하기엔 느리므로, 가까운 후보만 빠르게 좁혀 찾는 색인이 필요하다.
- 거리: cosine(`<=>`, `vector_cosine_ops`). architecture 확정. (참고: 정규화 벡터라 내적 `<#>`도 수학적으로 동치이며 약간 빠르나, 채택 연산자는 cosine이다.)
- `context` 컬럼은 제거됨(architecture 확정). Contextual Retrieval 미적용(§5.3)에 맞춰 스키마에서 뺐다.
- 1024-dim은 HNSW 한계(2000) 이내라 `halfvec` 불필요(대규모 시 저장 절반 옵션).
- 메타 필터는 `jsonb`+GIN, 강한 필터 시 partial HNSW 또는 `hnsw.iterative_scan`.

---

## 6. 비동기 인제스트 파이프라인

| 옵션                      | 적합성                                                           |
| ------------------------- | ---------------------------------------------------------------- |
| FastAPI `BackgroundTasks` | 데모 전용(상태추적, 재시도, 내구성 없음, 웹프로세스와 함께 죽음) |
| arq + Redis               | 권장(asyncio 네이티브, 잡 영속, 재시도/타임아웃/크론, 상태 API)  |
| Celery + Redis            | 확장 안전판이나 MVP엔 과함                                       |

- 결정: arq + Redis. OCR/임베딩은 CPU/GPU 무거우므로 요청 스레드 분리 필수.
- `documents.status`: `uploaded`, `processing`, `ready|failed`.
- `stage`: `extracting`, `generating_meta`, `chunking`, `embedding`.
- 페이지/스테이지 단위 멱등(같은 작업을 여러 번 실행해도 결과가 한 번과 동일), 재시작.
  - 한 페이지 실패가 문서 전체를 죽이지 않게 함.
  - OCR 타임아웃은 백오프 재시도. (VLM은 MVP 미채택이라 호출 제한 정책은 추후 검토.)
  - 왜?(초보자 설명) 작업이 중간에 실패해 다시 돌려도 청크, 임베딩이 중복으로 쌓이지 않게 하려는 것이다.
- 참고 구현: `CatchTheTornado/text-extract-api`(FastAPI+Celery+Redis+다중 OCR).

---

## 7. 인제스트 권고 요약

| 관심사     | 결정                                                                                   |
| ---------- | -------------------------------------------------------------------------------------- |
| 타입 감지  | `filetype`/`python-magic` (magic bytes)                                                |
| PDF        | pypdf(BSD) 텍스트 + pdfplumber(MIT) 표 보강, 페이지별 OCR 폴백 (PyMuPDF는 AGPL로 제외) |
| 스캔 판별  | 페이지별 `len(extract_text())<threshold` + `page.images` 유무                          |
| OCR        | PaddleOCR PP-OCRv5(ko) 기본 + Tesseract ko 폴백 (VLM/Qwen2.5-VL은 MVP 미채택, 추후 검토) |
| TXT 인코딩 | charset-normalizer, EUC-KR을 CP949로 디코딩                                            |
| MD         | Markdown 유지, 헤더 인지 청킹                                                          |
| 표         | Markdown 직렬화, 원자 임베딩                                                           |
| 메타       | intrinsic+NLP+LLM(`--json-schema`), 편집가능, 이력 보존                                |
| 임베딩     | KURE-v1(1024), `--pooling cls`                                                         |
| 청킹       | 재귀 512토큰/64오버랩, 토크나이저 측정, 구조 인식                                      |
| 벡터DB     | pgvector HNSW cosine, `m=16 ef_construction=200`                                       |
| 비동기     | arq+Redis, status/stage, 멱등                                                          |

---

## 8. 메타데이터 사용자 보정 (provenance) - MVP 제외, 추후 과제

> §3에서 "메타: …편집가능, 이력 보존"으로 열어둔 항목의 심화 조사. MVP 범위에서는 제외한다. 현재는 AI가 생성한 메타데이터를 그대로(읽기 전용) 표시한다. 오입력 메타를 (a)사람이 직접 입력해 보정할지, (b)AI와 프롬프트를 주고받아 보정할지는 추후 결정. 아래는 그때 참고할 사례, 설계 옵션 기록.

### 8.1 사용자 보정을 도입할 경우의 사례

| 사례                                   | 패턴                                                                                                    | 시사점                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Ex Libris Alma - AI Metadata Assistant | AI 생성 필드에 "data provenance" 서브필드를 부착해 출처(AI) 표식 보존, 정규화로 add/replace/remove      | 원본을 지우지 말고 출처를 메타로 남긴다    |
| C2PA / Content Credentials             | 변조 방지 메타로 생성, 편집 이력(provenance) 보존                                                       | AI/사람 편집을 이력으로 분리 기록          |
| Google Document AI / AWS - HITL 검수   | confidence score 색(녹/황/적) + 필드별 confirm/correct, AI 추출값 pre-fill(빈칸 타이핑보다 보정이 빠름) | 입력 UX = 미리 채운 값 보정, 신뢰도 시각화 |
| IDP 일반(Parseur 등)                   | 사람 override를 추적해 피드백 루프로 모델 개선                                                          | override는 별도로 추적 가능해야 함         |

요지(공통):

1. AI 원본을 덮어쓰지 않고 보존.
2. 출처/편집 여부 명시(provenance).
3. 입력은 pre-fill 보정.
4. override는 구분 저장, 추적.

### 8.2 보정 도입 시 설계 옵션 (참고)

- 저장: AI 원본 `llm_*`은 불변 보존(계보, 재현성 정렬), 사용자 보정은 별도 컬럼(`user_*`)+`metadata_edited_at`에 기록, 표시값 = `COALESCE(user_*, llm_*)`.
  - 덮어쓰기는 원본 소실로 기각.
  - JSONB provenance 맵은 복잡도로 후순위.
  - 페어 컬럼이 최단순, 무손실.
- 표시: 필드별 출처를 `user_* IS NOT NULL`로 도출해 "AI 생성 / 수정됨" 배지 + "AI 원본으로 되돌리기".
- (b) AI 프롬프트 보정안: 사용자가 자연어로 수정 요청하면 LLM이 메타 재생성. 이 경우 계보(`generations`/provenance)와의 통합 설계가 추가로 필요하므로 별도 검토.

> 조사일: 2026-06-10 추가(게이트 2차 피드백 기록). MVP 미구현.
