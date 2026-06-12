---
created: 2026-06-12
updated: 2026-06-12
status: draft
overview: 인제스트 파이프라인의 백엔드 구현 — arq 워커, 추출/OCR/메타/청킹/임베딩 도구 선택과 호출 흐름. 도메인 정의는 ingestion.md.
refs: research/01, research/04 §4
---

# 인제스트 백엔드 (워커)

- 공통 구조·Provider 추상화는 `backend.md`. 도메인 단계 정의는 `ingestion.md`, 청크 스키마는 `documents-schema.md`.

## 1. 오케스트레이션 (arq)
- `complete` → arq/Redis enqueue.
- `pipeline/{worker,tasks}`가 extract → meta → chunk → embed → ready 순으로 실행(단계·상태 정의는 ingestion.md §2·§3·§4). 실패 시 `failed` + error.
- 멱등 키 `(document_id, stage)`, 백오프 재시도. 페이지/스테이지 단위 멱등, 한 페이지 실패가 문서 전체 중단 안 함.
- 진행 보고: `documents.status/stage` 갱신(프론트 폴링). 소요는 `documents.ingest_ms` 기록.

## 2. 파일 타입 감지
- magic bytes(`filetype`/`python-magic`)로 PDF/이미지/TXT/MD 라우팅(확장자 불신).

## 3. PDF 추출
- 기본 텍스트 `pypdf`(BSD) `extract_text()`. 표/복잡 레이아웃은 `pdfplumber`(MIT)로 보강(Markdown 표 직렬화). PyMuPDF는 AGPL로 제외.
- 페이지별 스캔 판별: `len(extract_text().strip()) < THRESHOLD` + `page.images` 유무.
- OCR 입력: `page.images` 추출 또는 `pdf2image`(Poppler) 풀페이지 렌더.

## 4. OCR
- PaddleOCR PP-OCRv5(기본) → Tesseract `kor`(폴백) → (선택) Qwen2.5-VL(어려운 페이지, llama-swap 온디맨드).
- 페이지 단위·타임아웃·재시도, 부분 실패 격리.

## 5. TXT / MD
- TXT 인코딩: `charset-normalizer`, EUC-KR→CP949 안전 디코딩(상위집합), 크래시 금지.
- MD: 헤더 인지 청킹으로 구조 보존, 평문화 금지.

## 6. 메타데이터 생성
- intrinsic: pypdf/Tika(page_count·author·날짜). NLP: 언어감지·키워드.
- LLM: `--json-schema`(GBNF, backend.md §9)로 `{title,summary,topics[],keywords[]}` — MVP 읽기 전용.

## 7. 청킹
- 재귀 분할 512토큰/64오버랩(실제 토크나이저로 측정), 표는 원자 단위(행 중간 분할 금지). (선택) Contextual Retrieval prefix.

## 8. 임베딩 & 저장
- KURE-v1로 청크 임베딩(1024d, `--pooling cls`, 출력 L2 정규화됨 → 이중 정규화 금지) via EmbeddingClient.
- `archive.document_chunks` 멱등 upsert(`UNIQUE(document_id, chunk_index)`, documents-schema.md).

## 9. 설계 결정
- arq + Redis 채택(BackgroundTasks 제외 — 상태추적·내구성).
- 임베딩 KURE-v1 1024d 로컬 고정(차원 lock-in, schema-rule).

## 10. 운영 배포 전 TODO
- pdf2image Poppler 의존
  - 해결: [ ]
  - 비고: 배포 환경 Poppler 설치 확인.
