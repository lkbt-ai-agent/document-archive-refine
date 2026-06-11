---
created: 2026-06-11
updated: 2026-06-11
status: draft
overview: 아키텍처 설계 문서 색인. 레이어별 서브디렉토리로 구성.
refs: research/, research/06-glossary
---

# Document Archive AI — 아키텍처 설계 문서

`research/`의 세부 설계를 바탕으로 작성한 아키텍처 문서 모음.
**핵심 인프라 제약:** PostgreSQL·MinIO는 원격에 이미 배포됨 → 연결만 하고 로컬 중복 정의 금지.

## 문서 색인
- `01-overview/` — 시스템 개요·스택·배포 토폴로지
  - [system-overview](./01-overview/system-overview.md)
- `02-infrastructure/` — 원격 PG/MinIO 연결, 환경변수, Redis·llama 런타임, 확장 검증
  - [infrastructure](./02-infrastructure/infrastructure.md)
- `03-data/` — 전체 스키마(폴더·문서·청크·계보), 인덱스, Alembic
  - [data-model](./03-data/data-model.md)
- `04-domains/` — 비즈니스 기능·프로세스 플로우·도메인 규칙·기능별 API 계약
  - [folders](./04-domains/folders.md) — 폴더 트리 CRUD·MOVE
  - [document-storage](./04-domains/document-storage.md) — MinIO presigned 업/다운로드
  - [ingestion](./04-domains/ingestion.md) — 추출·OCR·메타·청킹·임베딩
  - [search-and-rag](./04-domains/search-and-rag.md) — 하이브리드 검색·RAG
  - [ai-outputs](./04-domains/ai-outputs.md) — 요약/초안/보고서·계보
- `05-backend/` — 백엔드 구조·공통 API 규약·Provider 추상화·코딩 가이드
  - [backend-application](./05-backend/backend-application.md)
- `06-frontend/` — 3-Panel UI·UI/UX 설계·프론트 코딩 가이드
  - [frontend-drive-ui](./06-frontend/frontend-drive-ui.md)

## TL;DR 결정
- 인프라: **PostgreSQL·MinIO 원격 고정**(연결만), Redis 별도 provisioning.
- DB 드라이버: psycopg3 async(`postgresql+psycopg`), 전용 스키마 `archive`.
- 확장: pgvector + PGroonga(배포 전 가용성·권한 검증 필수).
- 생성 LLM: A.X 4.0 Light 7B (llama.cpp, 개발자 Mac mini 네이티브 Metal).
- 임베딩: KURE-v1 1024d(로컬 고정). OCR: PaddleOCR+Tesseract+(선택)Qwen2.5-VL.
- PDF 추출: pypdf(BSD)+pdfplumber(MIT), PyMuPDF 제외(AGPL).
- 검색: PGroonga TokenBigram + pgvector HNSW, RRF k=50.
- 폴더 트리: 인접 리스트 + 재귀 CTE. 스토리지: 원격 MinIO presigned, key `docs/{uuid}`.
- 비동기: arq + Redis. 계보: `generations` 헤드 + 하위, 행 스냅샷.
- 프론트: Next.js RSC 셸 + Client 패널, react-query + Zustand, shadcn/Tailwind.

## 근거
세부 비교·벤치마크는 [`research/`](../research/), 용어는 [`research/06-glossary.md`](../research/06-glossary.md).
