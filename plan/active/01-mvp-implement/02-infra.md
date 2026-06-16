---
created: 2026-06-11
completed: —
overview: 원격 PG/MinIO 연결 검증 + 로컬 런타임(Redis·llama) 기동 (infrastructure, Phase 1 게이트 승인 후 진입).
---

> 라이브러리·툴 버전·CLI 옵션 상세는 context7 MCP로 확인.

## 연결·스키마
- [ ] A1 `.env` 키 카탈로그(DATABASE_URL/MINIO_*/REDIS_URL/LLAMA_*/LLM_PROVIDER/EMBEDDING_PROVIDER/DB_SCHEMA) (§2).
- [ ] A2 DB 확장 가용성·`CREATE` 권한 검증 + `vector`·`pgroonga`를 `archive_ext`에 설치 (data-overview §5, 선행 필수).
- [ ] A3 `archive`(테이블)·`archive_ext`(확장) 스키마 생성 + `search_path=archive,archive_ext` (§3).
- [ ] A4 원격 MinIO 연결·단일 버킷 보장(멱등) (§4).

## 런타임·실행
- [ ] B1 Redis 기동(로컬 Docker `redis:7-alpine`) + `REDIS_URL` (§5).
- [ ] B2 llama-server 기동 — 생성 8080 / 임베딩 8081(KURE-v1) (§6).
- [ ] B3 api·worker·web·redis만 프로세스화(PG·MinIO 정의 금지) (§7).
- [ ] B4 헬스체크 — PG/MinIO/Redis/llama, PG/MinIO 실패 시 fail-fast (backend §11).
