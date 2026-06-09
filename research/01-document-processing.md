# 01. 문서 처리 — 텍스트 추출 · OCR · 메타데이터 · 임베딩

> ### 💡 이 문서를 읽기 전에 (핵심 용어)
> 이 문서는 **AI를 처음 배우는 개발자**도 따라올 수 있게 작성되었다. 아래 용어만 알면 본문이 쉬워진다.
> - **텍스트 추출**: 파일(PDF·이미지·TXT) 안의 글자를 디지털 텍스트로 뽑아내는 것.
> - **OCR**: 이미지·스캔 속 글자를 디지털 텍스트로 변환하는 기술.
> - **VLM**: 이미지와 글자를 함께 이해하는 AI(어려운 OCR에 사용).
> - **임베딩**: 글의 *의미*를 숫자 목록(벡터)으로 바꾸는 것 — 의미가 비슷하면 숫자도 가깝다.
> - **청킹**: 긴 문서를 검색·임베딩하기 좋게 작은 조각(청크)으로 나누는 것.
> - **토큰**: AI가 글자를 처리하는 최소 단위(한국어 1글자≈1.5~3토큰).
> - **양자화 / GGUF**: 모델을 더 가볍게 압축하는 것(양자화) / llama.cpp가 쓰는 모델 파일 포맷(GGUF).
> - **풀링**: 임베딩 모델이 여러 토큰 벡터를 한 문장 벡터로 합치는 방식(`cls`·`mean`·`last`).
> - **pgvector / HNSW**: PostgreSQL에 벡터 검색을 더하는 확장(pgvector) / 벡터를 빠르게 찾는 색인(HNSW).
>
> 더 자세한 정의는 [용어집](./06-glossary.md) 참고.

requirement TODO 해소: **텍스트 추출 방식 / 메타데이터 생성 / 임베딩 방식**.

---

## 1. 파일 타입 감지 (확장자 신뢰 금지)

`filetype`(순수 파이썬, 시스템 의존 없음) 또는 `python-magic`(libmagic)으로 **magic bytes**(파일 맨 앞 몇 바이트에 들어 있는 고유 서명 — 확장자가 거짓이어도 실제 형식을 알려줌) 기반 MIME 판별 후 라우팅.

> **왜?(초보자 설명)** 사용자가 `.txt`로 이름만 바꾼 PDF를 올릴 수 있어 확장자는 신뢰할 수 없다. 파일 내용 앞부분(magic bytes)을 직접 보면 실제 형식을 정확히 알 수 있다.

| MIME | 경로 |
|---|---|
| `application/pdf` | PDF 경로 |
| `image/png\|jpeg\|webp` | OCR 경로 |
| `text/plain` | TXT(인코딩 감지) 경로 |
| `text/markdown` (또는 `.md`) | Markdown 경로 |

---

## 2. 타입별 텍스트 추출

### 2.1 PDF — PyMuPDF(`pymupdf4llm`) + 페이지별 OCR 폴백

| 라이브러리 | 속도 | 레이아웃 | 표 | 한국어(네이티브) | 라이선스 | 판정 |
|---|---|---|---|---|---|---|
| **PyMuPDF / `pymupdf4llm`** | 최速(~0.01–0.12s/p) | 양호, MD 출력 | `find_tables()` | 우수(유니코드) | **AGPL-3.0** ⚠️ | **기본 추출기** |
| pdfplumber | ~0.1s/p | 좌표/디버그 | **규칙기반 표 최강** | 양호 | MIT | 표 많은 PDF 보조 |
| pypdf | 빠름 | 약함 | 약함 | 보통 | BSD | 라이선스 회피용 폴백 |
| Docling(IBM) | 0.3–3s/p | ML 레이아웃 | **표 최강(TEDS 0.887)** | 양호 | MIT | phase-2 품질 업그레이드 |
| Marker | 5–11s/p(CPU) | 우수(PDF→MD) | 양호 | Surya 기반 | GPL성/상업 | 무거움, MVP 제외 |

- **결정:** `pymupdf4llm.to_markdown()` 단일 경로. 최速, 한국어 유니코드 OK, Markdown 출력(하위 청킹(→ [용어집](./06-glossary.md#청크--청킹-chunk--chunking))에 유리), **빈 텍스트 페이지 자동 OCR(이미지·스캔 속 글자를 디지털 텍스트로 변환 → [용어집](./06-glossary.md#ocr-optical-character-recognition-광학-문자-인식)) 폴백** 내장.
- **⚠️ 라이선스:** PyMuPDF는 **AGPL-3.0**. 네트워크 서비스로 배포 시 소스 공개 의무가 발생할 수 있다. 내부/로컬 MVP는 무방하나, 외부 배포 계획이 있으면 (a) Artifex 상업 라이선스 구매 또는 (b) 네이티브 추출을 pypdf(BSD)/pdfplumber(MIT)로 교체. **설계 결정 포인트로 명시.**

#### 스캔/이미지 PDF 판별 (페이지 단위)
혼합 PDF가 흔하므로 **페이지별**로 판정:
1. `len(page.get_text("text").strip()) < THRESHOLD`(≈20–50자) → OCR 후보.
2. 이미지 bbox 면적이 페이지 대부분을 덮으면 스캔으로 강한 신호.
3. 폰트가 `GlyphlessFont`이면 이미 Tesseract OCR된 PDF.

> **왜?(초보자 설명)** 한 PDF 안에 디지털 텍스트 페이지와 스캔 이미지 페이지가 섞여 있는 경우가 흔하다. 그래서 문서 전체가 아니라 **페이지마다** OCR이 필요한지 따로 판정한다(필요 없는 페이지에 OCR을 돌리면 느리고 품질도 나빠짐).

→ `List[(page_no, needs_ocr)]` 반환해 혼합 문서 처리.

### 2.2 이미지(PNG/JPG/JPEG/WEBP) — OCR 경로 (§3)

### 2.3 TXT — 인코딩 감지 (한국어 핵심: CP949/EUC-KR)

| 라이브러리 | 한국어 인코딩 | 비고 |
|---|---|---|
| **charset-normalizer** | EUC-KR/CP949 양호 | MIT, `requests` 기본. **권장** |
| chardet | EUC-KR(단 UHC/CP949 라벨 부재 이슈 #164) | LGPL |
| cchardet | UHC/CP949 정확하나 최신 파이썬 미지원 | 회피 |

**핵심 함정:** CP949(=UHC)는 EUC-KR의 상위집합(+한글 8천자). 감지기가 "EUC-KR"로 답해도 **CP949로 디코딩**하면 안전(상위집합). 권장 로직:
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

### 2.4 Markdown — 구조 보존 (평문화 금지)

- **MD를 평문으로 깎지 말 것.** 헤딩/리스트/코드펜스/표는 가장 신뢰도 높은 청크 경계다.
- LangChain `MarkdownHeaderTextSplitter`로 헤딩 계층을 청크 메타데이터에 실어 보존.

---

## 3. OCR (한국어)

OCR(이미지·스캔 속 글자를 디지털 텍스트로 변환 → [용어집](./06-glossary.md#ocr-optical-character-recognition-광학-문자-인식))은 두 갈래로 한다: **CPU에서 도는 전통 엔진**(가볍고 빠름, 기본값)과 **AI 모델(VLM)을 쓰는 방식**(무겁지만 어려운 레이아웃에 강함).

> **왜?(초보자 설명)** 대부분의 페이지는 전통 OCR이면 충분하고 메모리도 거의 안 쓴다. VLM은 표·복잡한 레이아웃 같은 *어려운 페이지*에만 선택적으로 꺼내 쓴다(아래 §3.2의 메모리 주의 참고).

### 3.1 전통 엔진

| 엔진 | 한국어 | 정확도 | 속도 | 배포 | 라이선스 | 판정 |
|---|---|---|---|---|---|---|
| **PaddleOCR PP-OCRv5** | ✅(v5부터) | 높음 | 빠름 | 중(Paddle 의존) | Apache-2.0 | **기본** |
| **Tesseract `kor`** | ✅(성숙) | 깨끗한 스캔 양호 | 빠름(CPU) | **최易** | Apache-2.0 | **무마찰 폴백** |
| EasyOCR | ✅ | GPU시 양호 | CPU 느림 | 易 | Apache-2.0 | 대안 |
| Surya | ✅(90+) | 높음(레이아웃) | GPU 빠름 | 易 | 확인要 | GPU시 강력(Marker/Docling 기반) |
| docTR | ❌(라틴 중심) | — | — | — | — | **한국어 제외** |

### 3.2 VLM OCR (llama.cpp에서 직접 — 런타임 재사용)

VLM(이미지와 텍스트를 함께 이해하는 LLM → [용어집](./06-glossary.md#vlm-vision-language-model))을 OCR에 쓰는 방식. llama.cpp에서 돌리려면 모델 본체(GGUF: llama.cpp용 모델 파일 포맷 → [용어집](./06-glossary.md#gguf))와 함께 **mmproj**(이미지를 토큰으로 바꿔주는 보조 파일 → [용어집](./06-glossary.md#mmproj))가 필요하다.

llama.cpp `docs/multimodal.md` 공식 확인 기준:

| 모델 | llama.cpp | GGUF+mmproj | 한국어 OCR | 판정 |
|---|---|---|---|---|
| **Qwen2.5-VL-7B** | **공식 지원** | `ggml-org/Qwen2.5-VL-7B-Instruct-GGUF` | 7B≈77.6% / 72B≈94.8%(PM4Bench) | **VLM 픽** |
| Qwen2-VL | 공식 지원 | 있음 | 양호 | 2.5가 우위 |
| MiniCPM-V 2.6 | 지원 | 있음 | 양호 | 대안 |
| GOT-OCR2.0 | **미지원**(아키텍처) | — | 강함 | **로드 불가, 제외** |
| Llama 3.2 Vision | 불안정·무거움 | 일부 | 약함 | 제외 |

실행 예:
```bash
llama-server -hf ggml-org/Qwen2.5-VL-7B-Instruct-GGUF   # /v1/chat/completions 로 이미지+프롬프트
```

> **🖥️ 로컬 하드웨어(메모리) 주의 — Mac mini(M4) / 24GB 통합 메모리.** 로컬 배포 대상은 **Mac mini(M4 칩) + 24GB 통합 메모리(Unified Memory)**이며, llama.cpp는 **Metal**(애플 GPU 가속) 백엔드로 돈다. 일반 PC의 그래픽 카드 전용 메모리(VRAM)가 아니라 **CPU·GPU가 같은 메모리를 공유**하는 구조라(→ [용어집](./06-glossary.md#apple-silicon--metal--통합-메모리-unified-memory)), 한 모델이 메모리를 점유하면 그만큼 다른 모델 몫이 줄어든다.
> - macOS가 ~3~4GB를 먼저 쓰므로 모델에 쓸 수 있는 실제 예산은 24GB보다 작다.
> - OCR용 VLM(**Qwen2.5-VL-7B Q4 ~6GB + mmproj**)은 **상주시키지 말고**, 생성 모델·임베딩 모델과 메모리를 나눠 쓰는 부담을 피하기 위해 **필요할 때만 로드**(예: `llama-swap`으로 on-demand 스왑)한다. 메모리가 공유 자원이라 세 모델을 동시에 올리려 하면 압박이 크다.
> - 기본 OCR(**PaddleOCR / Tesseract, CPU**)은 메모리를 거의 안 쓰므로 항상 켜 두는 기본값으로 유지하고, VLM은 어려운 페이지에만 꺼내 쓴다.

> **☁️ 제공자(Provider) 노트(선택).** 향후 무거운 OCR은 **AWS Bedrock**(관리형 클라우드 AI 서비스 → [용어집](./06-glossary.md#provider-제공자--aws-bedrock))에서 돌리도록 Provider 추상화를 통해 전환할 수 있다. 다만 **로컬 PaddleOCR/Tesseract가 MVP 기본값**이며, 추상화 구조 자체는 [04-architecture.md](./04-architecture.md)가 다룬다.

### 3.3 OCR 권고 (MVP)
- **PaddleOCR PP-OCRv5(한국어)** 기본, **Tesseract `kor`** 폴백.
- **Qwen2.5-VL-7B**는 표/복잡 레이아웃 등 *어려운 페이지*에만 선택 적용하며, 24GB 통합 메모리에서는 상주가 아니라 on-demand 로드(§3.2)로 쓴다. 단 7B 한국어≈78%는 "이해" 수준이지 완벽 전사가 아님(고정밀이 필요한 32B/72B급은 24GB 로컬에 부담 → 향후 AWS Bedrock 등 클라우드 Provider로 위임 고려).

> PM4Bench 한국어 수치(77.6/94.8)는 단일 출처(검색 요약) → 인용 전 재확인 권장.

---

## 4. 메타데이터 생성

DMS 관행에 따라 **시스템(불변) / 기술-의미(생성·편집가능)** 로 구분 저장.

| 범주 | 필드 | 소스 |
|---|---|---|
| 파일 | `size_bytes`, `mime_type`, `sha256`, `original_filename` | 업로드/`stat_object`, 추출 중 해시 |
| 내재 | `page_count`, `author`, `doc_created_at`, `doc_modified_at` | PDF/Office 메타(pypdf/Tika) |
| 파생(NLP) | `language`(한국어=`ko`), `keywords[]`, `word_count` | 언어감지/키워드추출 |
| **LLM 생성** | `llm_title`, `llm_summary`, `topics[]`, 자동 태그 | A.X 4.0 Light에 추출 텍스트 투입 |
| 의미 | 청크별 `embedding`(글 의미를 담은 숫자 벡터 → [용어집](./06-glossary.md#임베딩-embedding)) | KURE-v1 → pgvector(→ [용어집](./06-glossary.md#pgvector)) |

- **LLM 메타 추출은 `--json-schema`(GBNF) 제약 디코딩**으로 항상 유효 JSON 보장:
  ```jsonc
  { "title": str, "summary": str, "topics": [str], "keywords": [str],
    "doc_type": str, "language": "ko" }
  ```
  한국어 필드 설명 + 1-shot 한국어 예시를 프롬프트에 넣어 날짜/숫자 포맷 안정화.
- LLM 생성값은 **사용자 편집 가능**, 생성 이력은 `ai_generations`에 보존(우측 패널 "AI 생성 이력 요약").
- 스키마는 [04-architecture.md](./04-architecture.md) §4b 참조.

---

## 5. 임베딩 & 청킹

임베딩(글의 의미를 숫자 벡터로 변환 → [용어집](./06-glossary.md#임베딩-embedding))과 청킹(긴 문서를 작은 조각으로 분할 → [용어집](./06-glossary.md#청크--청킹-chunk--chunking))은 의미 검색의 토대다.

> **왜?(초보자 설명)** 사람은 "연봉"과 "급여"가 같은 뜻임을 안다. 임베딩은 이 *의미*를 숫자 벡터로 바꿔, 글자가 달라도 의미가 가까우면 벡터도 가깝게 만든다. 그 덕에 키워드가 안 겹쳐도 의미로 문서를 찾을 수 있다.

### 5.1 임베딩 모델 — KURE-v1 (→ [00 문서](./00-summary-and-decisions.md) §1.2)
- 1024-dim(차원=벡터를 이루는 숫자 개수 → [용어집](./06-glossary.md#벡터-vector--차원-dimension)), 8192 ctx, MIT, GGUF(`Bingsu/KURE-v1-Q8_0-GGUF`; `Q8_0`은 양자화=모델을 더 가볍게 압축한 수준 → [용어집](./06-glossary.md#양자화-quantization)).
- llama-server 임베딩 모드:
  ```bash
  llama-server -m KURE-v1-Q8_0.gguf --embeddings --pooling cls \
    --ctx-size 8192 --batch-size 8192 --ubatch-size 8192 -ngl 99
  ```
- **함정:**
  - 풀링(여러 토큰 벡터를 한 문장 벡터로 합치는 방식 → [용어집](./06-glossary.md#풀링-pooling)) 틀리면 결과 무의미 → bge-m3/KURE는 **`cls`**(e5=mean, Qwen3=last). **왜?(초보자 설명)** 모델마다 학습 때 정해진 합치는 방식이 있어, 다른 방식을 쓰면 의미가 깨진 벡터가 나온다.
  - `batch ≥ ctx` 위반 시 assert 크래시 → `--batch-size`,`--ctx-size` 명시.
  - `/v1/embeddings`가 이미 L2 정규화 → **cosine/내적** 사용, 이중 정규화 금지.

### 5.2 청킹 전략

| 전략 | 한국어 적합 | 비고 |
|---|---|---|
| **재귀 분할(Recursive)** | **기본 권장** | CJK 인지 구분자, 단락→문장→단어 |
| 고정 토큰 | OK(오버랩 필요) | 단순 |
| 의미(semantic) | 위험 | 조각 과소화(평균 43토큰, 정확도 -15pt) → MVP 보류 |
| 구조 인식(MD헤더/페이지) | 강함 | 아카이브 문서에 유리 |

- **권장값: 512토큰(토큰=AI가 글자를 처리하는 최소 단위 → [용어집](./06-glossary.md#토큰-token)) / 64(12%) 오버랩.** bge-m3/KURE 학습 분포에 부합, 8192 한참 아래.
  - **왜?(초보자 설명)** 오버랩은 조각을 자를 때 경계에서 문맥이 끊기지 않게 **앞 조각의 끝부분을 다음 조각 앞에 약간 겹쳐** 넣는 것이다. 그래야 문장 중간에서 잘려도 의미가 보존된다.
- **한국어 주의:** 교착어라 한글 1자 ≈ XLM-R 서브워드 1.5–3토큰. "512토큰"은 영어보다 적은 한글 수 → **문자 수가 아니라 실제 모델 토크나이저로 측정**.
- 라이브러리: LangChain `RecursiveCharacterTextSplitter`/`MarkdownHeaderTextSplitter`(기본), Chonkie(56개국어, 추후 semantic), unstructured(PDF/DOCX 구조 파싱).

### 5.3 무엇을 임베딩할까 — 청크 + (선택) contextual prefix
- 기본: **청크 본문 + 임베딩 + 메타데이터**를 행 단위로 pgvector 저장. `parent_doc_id`로 주변 컨텍스트 반환(간이 parent-document retriever).
- **고ROI 옵션(Week 2 여유 시):** Anthropic *Contextual Retrieval*(맥락 보강 검색 → [용어집](./06-glossary.md#contextual-retrieval-맥락-보강-검색)) — 청크 임베딩 전에 "이 청크가 문서 어디에 속하는지" 한 줄 컨텍스트를 **로컬 LLM으로 생성해 prepend**(조각 앞에 붙임). Anthropic 보고 기준 top-20 검색 실패율 5.7%→2.9%(-49%). 로컬 LLM 사용 시 비용 0.
- **표:** Markdown 표로 직렬화해 **원자 단위로 임베딩**(행 중간 분할 금지, 헤더 행 반복). 사례상 RAG 정확도 ~20% 개선.

### 5.4 pgvector 스키마/인덱스

pgvector(PostgreSQL에 벡터 저장·검색을 더하는 확장 → [용어집](./06-glossary.md#pgvector))에 청크별 임베딩을 저장하고, HNSW(가까운 벡터를 빠르게 찾는 그래프 색인 → [용어집](./06-glossary.md#hnsw--ivfflat-벡터-인덱스))로 색인한다.

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE document_chunks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  parent_doc_id UUID,
  chunk_index   INT NOT NULL,
  content       TEXT NOT NULL,        -- 청크 본문 저장(필수)
  context       TEXT,                 -- 선택: contextual prefix
  metadata      JSONB,                -- {page, lang, section, tags...}
  embedding     vector(1024) NOT NULL,
  UNIQUE (document_id, chunk_index)
);
CREATE INDEX ON document_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 200);
CREATE INDEX ON document_chunks USING gin (metadata);
```

- **HNSW > IVFFlat**(RAG 기본): 더 나은 속도/재현율, 학습 단계 불필요. **왜?(초보자 설명)** 벡터 수가 많으면 전부 일일이 비교하기엔 느리므로, 가까운 후보만 빠르게 좁혀 찾는 색인이 필요하다.
- 거리: cosine(`<=>`). 정규화 벡터라 내적(`<#>`)도 동치이며 약간 빠름.
- 1024-dim은 HNSW 한계(2000) 이내 → `halfvec` 불필요(대규모 시 저장 절반 옵션).
- 메타 필터는 `jsonb`+GIN, 강한 필터 시 partial HNSW 또는 `hnsw.iterative_scan`.

---

## 6. 비동기 인제스트 파이프라인

| 옵션 | 적합성 |
|---|---|
| FastAPI `BackgroundTasks` | 데모 전용(상태추적·재시도·내구성 없음, 웹프로세스와 함께 죽음) |
| **arq + Redis** | **권장**(asyncio 네이티브, 잡 영속, 재시도/타임아웃/크론, 상태 API) |
| Celery + Redis | 확장 안전판이나 MVP엔 과함 |

- **결정: arq + Redis.** OCR/임베딩은 CPU/GPU 무거우므로 요청 스레드 분리 필수.
- `documents.status`: `uploaded→processing→ready|failed`, `stage`: `extracting→generating_meta→chunking→embedding`.
- **페이지/스테이지 단위 멱등(같은 작업을 여러 번 실행해도 결과가 한 번과 동일 → [용어집](./06-glossary.md#멱등성-idempotency))·재시작** — 한 페이지 실패가 문서 전체를 죽이지 않게, OCR 타임아웃은 백오프 재시도, VLM 호출은 횟수 제한. **왜?(초보자 설명)** 작업이 중간에 실패해 다시 돌려도 청크·임베딩이 중복으로 쌓이지 않게 하려는 것이다.
- 참고 구현: `CatchTheTornado/text-extract-api`(FastAPI+Celery+Redis+다중 OCR).

---

## 7. 인제스트 권고 요약

| 관심사 | 결정 |
|---|---|
| 타입 감지 | `filetype`/`python-magic` (magic bytes) |
| PDF | `pymupdf4llm`→Markdown, 페이지별 OCR 폴백 (AGPL 유의) |
| 스캔 판별 | 페이지별 `len(text)<threshold` + 이미지 커버리지 |
| OCR | PaddleOCR PP-OCRv5(ko) 기본 + Tesseract ko 폴백 + (선택)Qwen2.5-VL-7B |
| TXT 인코딩 | charset-normalizer, EUC-KR→**CP949 디코딩** |
| MD | Markdown 유지, 헤더 인지 청킹 |
| 표 | Markdown 직렬화·원자 임베딩 |
| 메타 | intrinsic+NLP+LLM(`--json-schema`), 편집가능, 이력 보존 |
| 임베딩 | KURE-v1(1024), `--pooling cls` |
| 청킹 | 재귀 512토큰/64오버랩, 토크나이저 측정, 구조 인식 |
| 벡터DB | pgvector HNSW cosine, `m=16 ef_construction=200` |
| 비동기 | arq+Redis, status/stage, 멱등 |
