# 02. 인프라 & 환경 구성 아키텍처 — 작성 플랜

> **산출물:** `architecture/02-infrastructure-and-environment.md`
> **상태:** ⬜ Not started
> **근거 research:** `research/00 §0`, `research/04 §6`
> **선행:** 01-system-overview

## 목적
원격 PostgreSQL·MinIO 연결, 환경설정/시크릿, Redis·llama-server 런타임, DB 확장 가용성 검증을 정의한다. **로컬 PG/MinIO 중복 provisioning은 설계하지 않는다.**

## 지켜야 할 제약 (이 문서가 제약의 1차 책임자)
- PostgreSQL: 원격 `49.247.14.186:5432/mirimiri`, 사용자 `mirimiriuser`, 드라이버 `psycopg`(psycopg3). **연결만.**
- MinIO: 원격 `http://49.247.14.186:9000`, bucket `document-archive-refine`. **연결만.**
- `.env` 시크릿은 환경변수 참조로만 문서화, `.gitignore` 대상 명시.

## 작성 단계 (= 아키텍처 문서 섹션)
- [x] S1. **환경변수 카탈로그** — `.env` 키 표(`DATABASE_URL`, `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`) + 추가 필요 키(`REDIS_URL`, `LLAMA_CHAT_URL`, `LLAMA_EMBED_URL`, `LLM_PROVIDER`, `EMBEDDING_PROVIDER`). 각 키 설명·예시(비밀값은 마스킹).
- [x] S2. **원격 PostgreSQL 연결 설계** — pydantic-settings로 `DATABASE_URL` 주입, SQLAlchemy async engine, `expire_on_commit=False`. **드라이버 결정:** `.env`의 psycopg3를 async로 사용(`postgresql+psycopg`) vs asyncpg로 전환 — 결정과 근거 기술.
- [x] S3. **DB 확장 가용성 검증 절차** — 원격 `mirimiri`에 `CREATE EXTENSION vector;`, `CREATE EXTENSION pgroonga;` 가능 여부 점검 SQL과, **권한 부족 시 대안**(DBA 요청 / 확장 사전설치 확인). 미가용 시 영향(벡터·키워드 검색 불가) 명시.
- [x] S4. **공유 DB 격리 전략** — `mirimiri` DB가 타 용도와 공유될 수 있으므로 **전용 스키마**(예: `archive`) 또는 테이블 접두어 채택. search_path·마이그레이션 영향 기술. (데이터모델 문서와 정합.)
- [x] S5. **원격 MinIO 연결 설계** — boto3/minio SDK 클라이언트, endpoint/secure(http) 설정, 버킷 존재 확인(부트 시 1회). **presigned URL 엔드포인트:** 원격 공인 IP라 서버·브라우저가 동일 엔드포인트 사용 가능(research의 internal/public 분리 불필요) — 단순화 명시.
- [x] S6. **Redis provisioning** — arq 큐용 Redis 필요(.env에 없음). 로컬 Docker 또는 원격 중 택1 결정, `REDIS_URL` 정의. (제약 #3은 PG/MinIO만 해당.)
- [x] S7. **모델 런타임(llama-server)** — 네이티브 실행(생성 8080 / 임베딩 8081 분리), `--embeddings --pooling cls`, (선택) llama-swap. Apple Silicon Metal 주의(Docker 금지). 실행 위치와 백엔드 접속 URL 주입.
- [x] S8. **실행 구성(개발/배포)** — api·worker·web·redis만 로컬/서버에서 구동하는 구성. **PG·MinIO 서비스는 정의하지 않음**(원격). docker-compose 예시를 쓸 경우 PG/MinIO 서비스 제거하고 원격 URL만 주입.
- [x] S9. **부트스트랩 잡** — `alembic upgrade head`, MinIO 버킷 존재 보장(없으면 생성), 확장 활성화 확인. 멱등 실행.

## 캡처할 핵심 결정 (research)
- llama-server는 네이티브(Metal), 인프라만 컨테이너 — 단 **PG/MinIO는 원격이므로 컨테이너에서 제외**.
- Provider 추상화 환경변수(`LLM_PROVIDER`, `EMBEDDING_PROVIDER`).

## 다이어그램
- [x] 배포/네트워크 다이어그램 — 로컬/서버 컴포넌트 ↔ 원격 PG/MinIO(공인 IP) 연결, 포트 표기.

## 제약·리스크·오픈 이슈
- [x] **확장 권한:** 원격 DB에서 `CREATE EXTENSION` 권한이 없을 수 있음 → 사전 확인 필수.
- [x] **psycopg3 async 호환:** SQLAlchemy 2 async + psycopg3 조합 검증.
- [x] **MinIO http(비TLS):** 자격증명 평문 전송 리스크 — 운영 시 TLS/터널 검토 항목.
- [x] **공인 IP 노출:** presigned URL이 공인 IP를 가리킴 — 접근 제어·TTL 짧게.

## 완료 기준
- [x] `architecture/02-*.md` 존재, S1~S9 충족.
- [x] 문서 어디에도 **로컬 PostgreSQL/MinIO 서비스 정의가 없음**.
- [x] 확장 가용성·Redis·드라이버 결정이 명시됨.
