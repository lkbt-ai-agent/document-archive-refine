# 07. 문서 처리 파이프라인 (인제스트) — 작성 플랜

> **산출물:** `architecture/07-document-processing-pipeline.md`
> **상태:** ⬜ Not started
> **근거 research:** `research/01` 전반, `research/04 §4`
> **선행:** 06-document-storage, 03-data-model, 04-backend-application

## 목적
업로드 확정 후 텍스트 추출 → 메타데이터 생성 → 청킹 → 임베딩 → 저장의 비동기 파이프라인을 정의한다.

## 지켜야 할 제약
- 임베딩 결과는 원격 PostgreSQL(pgvector)에 저장. 원본은 원격 MinIO.
- 임베딩 Provider 로컬 고정(차원 lock-in).

## 작성 단계 (= 아키텍처 문서 섹션)
- [x] S1. **파이프라인 개요** — `uploaded→processing→ready|failed`, stage `extracting→generating_meta→chunking→embedding`, 각 stage **멱등·재시작**.
- [x] S2. **파일 타입 감지** — magic bytes(`filetype`/`python-magic`) 기반 라우팅(PDF/이미지/TXT/MD).
- [x] S3. **PDF 추출** — **pypdf(BSD) 기본 + pdfplumber(MIT) 표 보강**(PyMuPDF는 AGPL로 제외). 페이지별 스캔 판별(`extract_text()` 길이 + `page.images`), OCR 입력은 `page.images` 추출 또는 `pdf2image`(Poppler) 렌더.
- [x] S4. **OCR** — PaddleOCR PP-OCRv5(기본) + Tesseract `kor`(폴백) + (선택) Qwen2.5-VL(어려운 페이지, llama-swap 온디맨드). 페이지 단위 적용·타임아웃·재시도.
- [x] S5. **TXT/MD** — 인코딩 감지(charset-normalizer, EUC-KR→CP949 안전 디코딩), MD 구조 보존(헤더 인지).
- [x] S6. **메타데이터 생성** — intrinsic(pypdf/Tika) + NLP(언어·키워드) + LLM(`--json-schema`로 title/summary/topics/keywords), 사용자 편집 가능·이력 보존.
- [x] S7. **청킹** — 재귀 분할 512토큰/64오버랩(토크나이저로 측정), 표는 Markdown 직렬화·원자 임베딩, (선택) Contextual Retrieval prefix.
- [x] S8. **임베딩 & 저장** — KURE-v1(1024d, `--pooling cls`, L2 정규화 주의) → `document_chunks` insert(멱등: `UNIQUE(document_id, chunk_index)`).
- [x] S9. **오케스트레이션(arq)** — 워커 태스크 분해, 진행 보고(`status/stage`, react-query 폴링), 페이지/스테이지 멱등·백오프, 부분 실패 격리(한 페이지 실패가 문서 전체 중단 안 함).

## 캡처할 핵심 결정 (research)
- arq+Redis(BackgroundTasks 제외), pypdf 라이선스 결정, KURE-v1 풀링/정규화 함정.

## 다이어그램
- [x] 인제스트 파이프라인 플로우(타입 분기·OCR 폴백 포함).
- [x] 상태/스테이지 전이도.

## 제약·리스크·오픈 이슈
- [x] **pypdf 추출 품질** — 복잡 레이아웃/표 약함 → pdfplumber 병용 기본화 검토.
- [x] **Poppler 의존** — `pdf2image` 런타임에 Poppler 설치 필요.
- [x] **임베딩 차원 고정** — 1024 변경 시 전량 재임베딩.
- [x] **멱등 키** — 재시도 시 청크/임베딩 중복 방지 보장.

## 완료 기준
- [x] `architecture/07-*.md` 존재, S1~S9 충족.
- [x] 추출 스택이 pypdf/pdfplumber(허용형 라이선스)로 명시.
- [x] 멱등·부분실패·진행보고가 기술됨, 저장 대상이 원격 PG/MinIO임.
