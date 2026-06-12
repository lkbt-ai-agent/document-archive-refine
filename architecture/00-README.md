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
  - [schema-rule](./03-data/schema-rule.md) — 횡단 규칙(설계·명명·확장·Alembic·TODO)
  - [erd](./03-data/erd.md) — 엔티티 관계
  - [users-schema](./03-data/users-schema.md) — 사용자 스키마
  - [folders-schema](./03-data/folders-schema.md) — 폴더 스키마
  - [documents-schema](./03-data/documents-schema.md) — 문서·청크 스키마
  - [documents-minio](./03-data/documents-minio.md) — 문서 MinIO 오브젝트 로직·운영
  - [generations-schema](./03-data/generations-schema.md) — 생성 계보 스키마
  - [search-schema](./03-data/search-schema.md) — 검색 실 쿼리(키워드·의미·하이브리드)
- `04-domains/` — 비즈니스 기능·프로세스·도메인 규칙(자연어)
  - [folders](./04-domains/folders.md) — 폴더 트리 CRUD·MOVE
  - [document](./04-domains/document.md) — 문서 업/다운/삭제·레코드 상태
  - [ingestion](./04-domains/ingestion.md) — 추출·OCR·메타·청킹·임베딩
  - [search-and-rag](./04-domains/search-and-rag.md) — 하이브리드 검색·RAG
  - [ai-outputs](./04-domains/ai-outputs.md) — 요약/초안/보고서·계보
- `05-backend/` — 공통 구조·Provider 추상화 + 도메인별 백엔드 구현
  - [backend](./05-backend/backend.md) — 공통 구조·레이어링·Provider 추상화
  - [folders-backend](./05-backend/folders-backend.md)
  - [document-backend](./05-backend/document-backend.md)
  - [ingestion-backend](./05-backend/ingestion-backend.md)
  - [search-backend](./05-backend/search-backend.md)
  - [ai-outputs-backend](./05-backend/ai-outputs-backend.md)
- `06-frontend/` — 셸/공통 + 도메인별 프론트 구현
  - [frontend](./06-frontend/frontend.md) — 셸·레이아웃·데이터/상태 경계·테마·반응형
  - [folders-frontend](./06-frontend/folders-frontend.md)
  - [document-frontend](./06-frontend/document-frontend.md)
  - [search-frontend](./06-frontend/search-frontend.md)
  - [ai-outputs-frontend](./06-frontend/ai-outputs-frontend.md)

## 근거
세부 비교·벤치마크는 [`research/`](../research/), 용어는 [`research/06-glossary.md`](../research/06-glossary.md).
