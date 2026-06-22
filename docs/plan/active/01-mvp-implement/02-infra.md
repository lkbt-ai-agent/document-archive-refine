---
created: 2026-06-11
completed: 2026-06-19
overview: 원격 PG/MinIO 연결 검증 + 로컬 런타임(Redis·llama) 기동 (infrastructure, Phase 1 게이트 승인 후 진입).
---

> 라이브러리·툴 버전·CLI 옵션 상세는 context7 MCP로 확인.

## 연결·스키마
- [x] A1 `.env` 키 카탈로그(DATABASE_URL/MINIO_*/REDIS_URL/LLAMA_*/LLM_PROVIDER/EMBEDDING_PROVIDER/DB_SCHEMA) (§2). `.env` 완성 + `.env.example` 커밋.
- [x] A2 DB 확장 가용성·`CREATE` 권한 검증 + `vector`·`pgroonga`를 `archive_ext`에 설치 (data-overview §5, 선행 필수). 둘 다 `archive_ext` 설치·가용 확인.
- [x] A3 `archive`(테이블) 스키마 생성 + `search_path=archive,archive_ext` (§3). `archive_ext`는 A2에서 생성·설치. 두 스키마 owner=`mirimiriuser`, role 기본 search_path 설정, vector·pgroonga 해석 스모크 통과.
- [x] A4 원격 MinIO 연결·단일 버킷 보장(멱등) (§4).

## 런타임·실행
- [x] B1 Redis 기동(로컬 Docker `redis:7-alpine`) + `REDIS_URL` (§5). `docker-compose.yml`, ping=PONG.
- [x] B2 llama-server 기동 — 생성 8080 / 임베딩 8081(KURE-v1) (§6). `scripts/llama-{chat,embed}.sh`, arch 지정 모델(a.x-4.0-light Q4_K_M, kure-v1 Q8_0) 다운로드·네이티브 Metal 기동, 임베딩 1024d·채팅 스모크 통과.
- [x] B3 api·worker·web·redis만 프로세스화(PG·MinIO 정의 금지) (§7). `docker-compose.yml`(앱은 `--profile app`).
- [x] B4 헬스체크 — PG/MinIO/Redis/llama, PG/MinIO 실패 시 fail-fast (backend §11). `scripts/healthcheck.sh`, PG/MinIO/Redis OK.

## 임베딩 물리 배치 수정 (후속)
- 배경: 인제스트 임베딩 단계 500 — 청크 513토큰이 임베딩 서버 물리 배치(ubatch 기본 512)를 초과(`input is too large to process`). 청커 `TARGET_TOKENS=512`이지만 overlap·라인 경계·토크나이저 차이로 수 토큰 초과가 발생하고, 임베딩(non-causal pooling)은 입력 전체가 한 ubatch에 들어가야 함. 메타(생성 :8080)는 정상이라 status만 failed로 남는다.
- [x] C1 `scripts/llama-embed.sh`에 `--ubatch-size 8192` 추가 — 물리 배치를 ctx·논리 배치(8192)에 맞춰 청크 변동분을 흡수(KURE-v1 8192 지원, 모델 변경 아님). 아키텍처 `infrastructure §6`·`models.md` 임베딩 실행 명령에도 반영. 적용 후 임베딩 서버 재기동 + 실패 문서 재업로드로 ready 확인. (청커 `TARGET_TOKENS` 축소는 보강 옵션, 미적용.)
