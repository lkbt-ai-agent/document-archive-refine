---
created: 2026-06-10
completed: 2026-06-10
overview: architecture/02 작성 플랜 — 원격 PG/MinIO 연결·환경설정·Redis/llama 런타임·확장 가용성 검증(완료).
---

## 작성 단계
- [x] S1 환경변수 카탈로그(.env 키 + 추가 키).
- [x] S2 원격 PostgreSQL 연결(async engine, psycopg3 결정).
- [x] S3 DB 확장 가용성 검증 절차 + 권한 부족 대안.
- [x] S4 공유 DB 격리 — 전용 스키마 `archive`.
- [x] S5 원격 MinIO 연결(단일 공인 엔드포인트 단순화).
- [x] S6 Redis provisioning + `REDIS_URL`.
- [x] S7 llama-server 런타임(생성 8080 / 임베딩 8081, Metal).
- [x] S8 실행 구성 — api·worker·web·redis만(PG/MinIO 제외).
- [x] S9 부트스트랩 — alembic·버킷 보장·확장 확인(멱등).
