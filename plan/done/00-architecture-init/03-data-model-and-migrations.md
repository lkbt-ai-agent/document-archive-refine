---
created: 2026-06-10
completed: 2026-06-10
overview: architecture/03 작성 플랜 — 폴더·문서·청크·계보 DB 스키마 + Alembic 마이그레이션 전략(완료).
---

## 작성 단계
- [x] S1 ER 다이어그램(전체 테이블).
- [x] S2 `folders`(인접 리스트, 형제 유니크).
- [x] S3 `documents`(스토리지·파이프라인·메타·content).
- [x] S4 `document_chunks`(vector(1024), HNSW + GIN).
- [x] S5 계보 스키마(generations + 하위 + models/templates, ENUM).
- [x] S6 명명 규약 & Base(SQLAlchemy / Pydantic v2).
- [x] S7 확장 의존 & 격리(search_path, 미가용 영향).
- [x] S8 Alembic 전략(async, 수동 마이그레이션 HNSW·PGroonga).
- [x] S9 무결성·삭제 정책(CASCADE + MinIO/청크/계보 정리).
