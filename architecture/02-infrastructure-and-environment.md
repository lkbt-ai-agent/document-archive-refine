# 02. 인프라 & 환경 구성 아키텍처

## 1. 개요 / 범위
원격 PostgreSQL·MinIO 연결, 환경설정/시크릿, Redis·llama-server 런타임, DB 확장 검증을 정의한다.
**로컬 PostgreSQL/MinIO는 정의하지 않는다(원격 기존 인스턴스 연결만).**

## 2. 요구사항 매핑
배포 환경 전제(원격 PG/MinIO) + Provider 추상화 환경변수 + 모델 런타임.

## 3. 설계 결정
| 항목 | 결정 |
|---|---|
| PG 연결 | 원격 `49.247.14.186:5432/mirimiri`, **드라이버 psycopg3 async**(`postgresql+psycopg`, .env에 맞춤) |
| MinIO 연결 | 원격 `http://49.247.14.186:9000`, bucket `document-archive-refine` |
| Redis | .env에 없음 → **로컬 Docker 또는 원격 별도 provisioning**, `REDIS_URL` 정의 |
| llama-server | **개발자 Mac mini 네이티브(Metal)**, 생성 8080 / 임베딩 8081 분리 |
| DB 격리 | 공유 `mirimiri`에 **전용 스키마 `archive`** 사용 |

## 4. 환경변수 카탈로그
| 키 | 용도 | 예시(비밀 마스킹) |
|---|---|---|
| `DATABASE_URL` | PG 연결(psycopg3 async) | `postgresql+psycopg://mirimiriuser:***@49.247.14.186:5432/mirimiri` |
| `MINIO_ENDPOINT` | MinIO 엔드포인트 | `http://49.247.14.186:9000` |
| `MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY` | 자격증명 | `***` |
| `MINIO_BUCKET` | 버킷 | `document-archive-refine` |
| `REDIS_URL` | arq 큐 (추가) | `redis://localhost:6379/0` |
| `LLAMA_CHAT_URL` | 생성 서버 (추가) | `http://localhost:8080` |
| `LLAMA_EMBED_URL` | 임베딩 서버 (추가) | `http://localhost:8081` |
| `LLM_PROVIDER`/`EMBEDDING_PROVIDER` | Provider 선택 (추가) | `llamacpp` |
| `DB_SCHEMA` | 전용 스키마 (추가) | `archive` |

> 시크릿은 `.env`(=`.gitignore` 대상)로만 주입. 문서·코드에 평문 금지.

## 5. 원격 PostgreSQL 연결
- pydantic-settings로 `DATABASE_URL` 로드 → SQLAlchemy `create_async_engine(...)`, `async_sessionmaker(expire_on_commit=False)`.
- **드라이버:** `.env`가 `postgresql+psycopg`(psycopg3)이며 SQLAlchemy 2 async를 지원하므로 그대로 사용(asyncpg 전환 불필요).

## 6. DB 확장 가용성 검증 (선행 필수)
```sql
-- 권한·설치 확인 (배포 전 1회)
SELECT * FROM pg_available_extensions WHERE name IN ('vector','pgroonga');
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgroonga;
```
- 권한 부족(`CREATE EXTENSION` 거부) 시 → **DBA에 사전 설치 요청**.
- 미가용 영향: `vector` 없으면 의미 검색 불가, `pgroonga` 없으면 한국어 키워드 검색 품질 저하(폴백 `tsvector simple`).

## 7. 공유 DB 격리
- 전용 스키마 `archive`에 모든 테이블 생성. 연결 시 `search_path=archive,public`(확장은 public).
- Alembic `version_table_schema='archive'`로 버전 테이블도 격리.

## 8. 원격 MinIO 연결
- `minio` SDK(또는 boto3): `endpoint=49.247.14.186:9000`, `secure=False`(http).
- 부트 시 버킷 존재 확인, 없으면 생성(멱등).
- **presigned 단순화:** 원격 공인 IP 단일 엔드포인트라 서버·브라우저가 동일 URL 사용(research의 internal/public 분리 불필요).

## 9. Redis & 모델 런타임
- **Redis:** arq 큐용. 로컬 Docker(`redis:7-alpine`) 권장, `REDIS_URL` 주입. (제약 #3은 PG/MinIO만 해당.)
- **llama-server(Mac mini 네이티브):**
```bash
llama-server -m ax-4.0-light-q4_k_m.gguf -ngl 99 -c 8192 --port 8080   # 생성
llama-server -m kure-v1-q8_0.gguf --embeddings --pooling cls -ngl 99 \
  --ctx-size 8192 --batch-size 8192 --port 8081                         # 임베딩
```
- **Docker 금지(모델):** macOS Docker는 Metal 불가 → CPU-only로 느려짐. 모델은 호스트 네이티브.

## 10. 실행 구성 & 부트스트랩
- 컨테이너/프로세스: **api·worker·web·redis만**. **PG·MinIO 서비스는 정의하지 않음**(원격 URL 주입).
- 부트스트랩(멱등): `alembic upgrade head` → MinIO 버킷 보장 → 확장 활성화 확인.

## 11. 다이어그램
```mermaid
flowchart LR
  subgraph local["로컬/개발"]
    web --> api --> redis
    api --> worker --> redis
    api --> llama[llama-server Mac mini]
  end
  api -->|psycopg3| PG[(원격 PG)]
  worker --> PG
  api -->|minio SDK / presign| MinIO[(원격 MinIO)]
```

## 12. 제약·리스크
- 확장 `CREATE` 권한 부재 가능 → 사전 확인.
- MinIO http(비TLS)·공인 IP 노출 → presign TTL 단축, 접근 제어.

## 참고
`research/00 §0`, `research/04 §6`.
