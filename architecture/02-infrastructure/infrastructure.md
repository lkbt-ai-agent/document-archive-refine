---
created: 2026-06-11
updated: 2026-06-17
status: approved
overview: 원격 DB·MinIO 연결, 환경변수·시크릿, Redis·llama 런타임, DB 확장 검증을 정의한다.
refs: research/01-mvp-research/00 §0, research/01-mvp-research/04 §6
---

# 인프라 & 환경 구성

## 1. 모듈 스펙
- PostgreSQL — 원격 (§3)
- MinIO — 원격 (§4)
- Redis — 로컬 Docker (§5)
- llama-server — 로컬, 개발자 Mac mini 네이티브 Metal (§6)

## 2. 환경변수
값은 `.env`(=`.gitignore` 대상)로만 주입, 문서·코드에 평문 금지.
- `DATABASE_URL` — PostgreSQL 연결(psycopg3 async).
- `MINIO_ENDPOINT` / `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` / `MINIO_BUCKET` — MinIO 연결·자격·버킷.
- `REDIS_URL` — Redis 연결(§5).
- `LLAMA_CHAT_URL` / `LLAMA_EMBED_URL` — 생성/임베딩 서버.
- `LLM_PROVIDER` / `EMBEDDING_PROVIDER` — Provider 선택.
- `DB_SCHEMA` — 전용 스키마(§3).

## 3. DB·PostgreSQL
### 연결
- pydantic-settings로 `DATABASE_URL` 로드 → `create_async_engine(...)`, `async_sessionmaker(expire_on_commit=False)`.
  - `.env`의 연결 문자열을 설정 객체로 읽어 비동기 DB 엔진을 만들고, 그 엔진으로 세션 팩토리를 구성
  - `expire_on_commit=False`는 커밋 후에도 ORM 객체 속성을 재조회 없이 쓰기 위함(async에서 지연 로딩 재조회 방지).
- 드라이버: `.env`가 `postgresql+psycopg`(psycopg3)이며 SQLAlchemy 2 async 지원 → 그대로 사용(asyncpg 전환 불필요).
  - psycopg3가 비동기를 지원하므로 별도 asyncpg 드라이버로 교체하지 않고 현 연결 문자열을 그대로 쓴다.

### 공유 스키마 격리
- 새 DB를 만들지 않고 스키마로만 격리
- 전용 스키마 `archive`에 모든 테이블 생성, 확장은 전용 `archive_ext`. 연결 시 `search_path=archive,archive_ext`.
- Alembic `version_table_schema='archive'`로 버전 테이블도 격리.
- 앱 역할 권한: `archive` 소유(또는 CREATE), `archive_ext` USAGE(확장 타입/연산자 참조에 필요).

## 4. DB·MinIO
### 연결
- `minio` SDK: 원격 엔드포인트, `secure=False`(http).
- 버킷 1개만 사용
- 버킷 멱등 생성은 부트스트랩에서 수행(§7).
- presign 단순화: 원격 공인 IP 단일 엔드포인트라 서버·브라우저 동일 URL 사용.

## 5. DB·Redis
### 런타임
- arq 큐 용도
- 로컬 Docker(`redis:7-alpine`) 기동, `REDIS_URL` 주입.

## 6. AI·llama-server
### 런타임
- Mac mini 네이티브(Metal):
```bash
llama-server -m a.x-4.0-light-q4_k_m.gguf -ngl 99 -c 8192 --port 8080   # 생성
llama-server -m kure-v1-q8_0.gguf --embeddings --pooling cls -ngl 99 \
  --ctx-size 8192 --batch-size 8192 --ubatch-size 8192 --port 8081      # 임베딩(ubatch=ctx: 입력 전체 1배치)
```
- 모델 Docker 금지: macOS Docker는 Metal 불가(CPU-only로 느려짐) → 호스트 네이티브.
- 모델 정의(선정 이유/출처/양자화)는 `models.md`.

## 7. 실행 구성 & 부트스트랩
- 대상: api·worker·web·redis
- 비대상: PostgreSQL·MinIO 서비스는 정의하지 않음(원격).
- 부트스트랩 (앱 최초 기동 시 1회 수행하는 멱등 초기화 절차)
  1. DB 마이그레이션 적용: `alembic upgrade head`로 스키마를 최신 버전까지 올린다(이미 최신이면 아무것도 안 함).
  2. MinIO 버킷 생성: 업로드 대상 버킷이 있는지 확인하고 없으면 생성한다(있으면 그대로 둠).
  3. DB 확장 활성화 확인: `vector`·`pgroonga` 확장이 설치·활성 상태인지 점검하고, 없으면 활성화한다.

## 8. 운영 배포 전 TODO
- MinIO http(비TLS)·공인 IP 노출
  - 해결: [ ]
  - 비고: presign TTL 단축(5~15분)·발급 시 `owner_id` 검사는 상시 적용, 운영 전 TLS 종단/방화벽 출처 제한 필수.
