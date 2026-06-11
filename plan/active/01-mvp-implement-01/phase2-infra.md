---
created: 2026-06-11
completed: —
overview: 원격 PG/MinIO 연결 검증 + 로컬 런타임(Redis·llama) 기동 (infrastructure, Phase 1 게이트 승인 후 진입).
---

## 연결·스키마
- [ ] A1 `.env` 키 카탈로그(DATABASE_URL/MINIO_*/REDIS_URL/LLAMA_*/LLM_PROVIDER/DB_SCHEMA) (§3).
- [ ] A2 DB 확장 가용성·권한 검증 + `CREATE EXTENSION vector/pgroonga` (§5, 선행 필수).
- [ ] A3 전용 스키마 `archive` 생성 + `search_path=archive,public` (§6).
- [ ] A4 원격 MinIO 연결·버킷 보장(멱등) (§7).

## 런타임·실행
- [ ] B1 Redis 기동(로컬 Docker `redis:7-alpine`) + `REDIS_URL` (§8).
- [ ] B2 llama-server 기동 — 생성 8080 / 임베딩 8081 (§8).
- [ ] B3 api·worker·web·redis만 프로세스화(PG·MinIO 정의 금지) (§9).
- [ ] B4 헬스체크 — PG/MinIO/Redis/llama, PG/MinIO 실패 시 fail-fast (backend-application §11).
