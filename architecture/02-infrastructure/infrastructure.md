---
created: 2026-06-11
updated: 2026-06-11
status: draft
overview: 원격 PG·MinIO 연결, 환경변수·시크릿, Redis·llama-server 런타임, DB 확장 검증을 정의한다.
refs: research/00 §0, research/04 §6
---

# 인프라 & 환경 구성

## 1. 범위
원격 PostgreSQL·MinIO 연결, 환경설정/시크릿, Redis·llama-server 런타임, DB 확장 검증. **로컬 PG/MinIO는 정의하지 않는다(원격 기존 인스턴스 연결만).**

## 2. 설계 결정
- PG 연결: 원격, 드라이버 psycopg3 async(`postgresql+psycopg`, .env 기준).
- MinIO 연결: 원격, `secure=False`(http).
- Redis: .env에 없음 → 로컬 Docker 또는 원격 별도 provisioning, `REDIS_URL` 정의.
- llama-server: 개발자 Mac mini 네이티브(Metal), 생성 8080 / 임베딩 8081 분리.
- DB 격리: 공유 DB에 전용 스키마 `archive`.

## 3. 환경변수
값은 `.env`(=`.gitignore` 대상)로만 주입, 문서·코드에 평문 금지.
- `DATABASE_URL` — PG 연결(psycopg3 async).
- `MINIO_ENDPOINT` / `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` / `MINIO_BUCKET` — MinIO 연결·자격·버킷.
- `REDIS_URL` — arq 큐.
- `LLAMA_CHAT_URL` / `LLAMA_EMBED_URL` — 생성/임베딩 서버.
- `LLM_PROVIDER` / `EMBEDDING_PROVIDER` — Provider 선택.
- `DB_SCHEMA` — 전용 스키마(`archive`).

## 4. 원격 PostgreSQL 연결
- pydantic-settings로 `DATABASE_URL` 로드 → `create_async_engine(...)`, `async_sessionmaker(expire_on_commit=False)`.
- 드라이버: `.env`가 `postgresql+psycopg`(psycopg3)이며 SQLAlchemy 2 async 지원 → 그대로 사용(asyncpg 전환 불필요).

## 5. DB 확장 가용성 검증 (선행 필수)
```sql
SELECT * FROM pg_available_extensions WHERE name IN ('vector','pgroonga');
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgroonga;
```
- `CREATE EXTENSION` 권한 거부 시 → DBA에 사전 설치 요청.
- 미가용 영향: `vector` 없으면 의미 검색 불가, `pgroonga` 없으면 한국어 키워드 품질 저하(폴백 `tsvector simple`).

## 6. 공유 DB 격리
- 전용 스키마 `archive`에 모든 테이블 생성, 연결 시 `search_path=archive,public`(확장은 public).
- Alembic `version_table_schema='archive'`로 버전 테이블도 격리.

## 7. 원격 MinIO 연결
- `minio` SDK: 원격 엔드포인트, `secure=False`(http).
- 부트 시 버킷 존재 확인, 없으면 생성(멱등).
- presign 단순화: 원격 공인 IP 단일 엔드포인트라 서버·브라우저 동일 URL 사용.

## 8. Redis & 모델 런타임
- Redis: arq 큐용. 로컬 Docker(`redis:7-alpine`) 권장, `REDIS_URL` 주입.
- llama-server(Mac mini 네이티브):
```bash
llama-server -m ax-4.0-light-q4_k_m.gguf -ngl 99 -c 8192 --port 8080   # 생성
llama-server -m kure-v1-q8_0.gguf --embeddings --pooling cls -ngl 99 \
  --ctx-size 8192 --batch-size 8192 --port 8081                         # 임베딩
```
- 모델 Docker 금지: macOS Docker는 Metal 불가(CPU-only로 느려짐) → 호스트 네이티브.

## 9. 실행 구성 & 부트스트랩
- 프로세스: **api·worker·web·redis만**. PG·MinIO 서비스는 정의하지 않음(원격 URL 주입).
- 부트스트랩(멱등): `alembic upgrade head` → MinIO 버킷 보장 → 확장 활성화 확인.

## 10. 운영 배포 전 TODO
- MinIO http(비TLS)·공인 IP 노출
  - 해결: [ ]
  - 비고: presign TTL 단축(5~15분)·발급 시 `owner_id` 검사는 상시 적용, 운영 전 TLS 종단/방화벽 출처 제한 필수.
- 확장 `CREATE` 권한 부재 가능
  - 해결: [ ]
  - 비고: §5에서 사전 확인, 없으면 DBA 요청.
