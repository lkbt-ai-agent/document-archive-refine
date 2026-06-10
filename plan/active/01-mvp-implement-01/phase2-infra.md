---
status: active
scope: mvp
phase: 2
arch_ref: architecture/02-infrastructure-and-environment.md
index: plan.md
---

# Phase 2 — 인프라 셋업 (arch 02)

> 공통 규약(전역 제약·구현 규약·코드 스타일)은 [plan.md](./plan.md) 참조. 진입 전제: [Phase 1](./phase1-frontend-prototype.md) 게이트 승인.

원격 PG/MinIO 연결 검증 + 로컬 런타임(Redis·llama) 기동.

- [ ] 2.1 `.env` 키 카탈로그 작성(DATABASE_URL/MINIO_*/REDIS_URL/LLAMA_*/LLM_PROVIDER/DB_SCHEMA) (§4)
- [ ] 2.2 **DB 확장 가용성·권한 검증** — `pg_available_extensions` 확인, `CREATE EXTENSION vector/pgroonga` (§6, 선행 필수)
- [ ] 2.3 전용 스키마 `archive` 생성 + `search_path=archive,public` (§7)
- [ ] 2.4 원격 MinIO 연결·버킷 보장(`document-archive-refine`, 멱등) (§8)
- [ ] 2.5 Redis 기동(로컬 Docker `redis:7-alpine`) + `REDIS_URL` 주입 (§9)
- [ ] 2.6 llama-server 네이티브 기동 — 생성 8080 / 임베딩 8081(Mac mini Metal) (§9)
- [ ] 2.7 실행 구성 — api·worker·web·redis만 컨테이너/프로세스화(PG·MinIO 서비스 정의 금지) (§10)
- [ ] 2.8 헬스체크 — PG/MinIO/Redis/llama 연결 점검, PG/MinIO 실패 시 fail-fast (arch 04 §12)
