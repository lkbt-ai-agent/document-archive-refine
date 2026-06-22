---
created: 2026-06-09
updated: 2026-06-16
overview: 시스템 아키텍처, 데이터 모델, 프론트엔드, 인프라 설계를 정리한다.
---

# 04. 시스템 아키텍처, 데이터 모델, 프론트엔드, 인프라

requirement TODO 해소: 레이아웃(3-Panel), 폴더/문서 CRUD, 전체 데이터 모델, 인프라.

기술 스택 고정:

- 프론트: Next.js 16, React 19, TS, Tailwind 4, shadcn, Lucide
- 백엔드: FastAPI, Pydantic v2, SQLAlchemy 2, Alembic
- 데이터: PostgreSQL+pgvector, MinIO, llama.cpp

배포 전제:

- 로컬 = Mac mini(M4) + 24GB 통합 메모리
- 추후 일부 모델 = AWS Bedrock ([00 §0](./00-summary-and-decisions.md))

---

## 0. Provider 추상화 (로컬 llama.cpp, 추후 AWS Bedrock)

왜 필요한가(초보자 설명):

- AI 모델은 내 컴퓨터에서 직접(llama.cpp) 돌릴 수도, 클라우드 API(AWS Bedrock)로 빌려 쓸 수도 있다.
- 이 "어디서 돌리는가"를 Provider라 한다.
- 지금은 로컬이 기본이지만, 나중에 더 강력한 모델이 필요할 때 코드를 갈아엎지 않고 갈아끼울 수 있도록 인터페이스로 추상화해 둔다.

- **인터페이스 분리**: 비즈니스 로직(요약/검색/추출)은 구체 Provider가 아니라 추상 인터페이스에만 의존한다.

  ```python
  class LLMClient(Protocol):
      async def generate(self, *, system: str, prompt: str,
                         params: DecodeParams, json_schema: dict | None = None) -> LLMResult: ...
  class EmbeddingClient(Protocol):
      async def embed(self, texts: list[str]) -> list[list[float]]: ...

  # 구현체 (설정으로 선택)
  class LlamaCppLLM(LLMClient): ...      # llama-server /v1/chat/completions (로컬, Metal)
  class BedrockLLM(LLMClient): ...       # AWS Bedrock (예: Claude), 추후
  class LlamaCppEmbedding(EmbeddingClient): ...   # KURE-v1 (로컬)
  ```

- **무엇을 어디로 보낼지 (권장 정책)**:

  | 역할      | MVP(로컬)            | 추후 Bedrock 전환 | 주의                                                                        |
  | --------- | -------------------- | ----------------- | --------------------------------------------------------------------------- |
  | 임베딩    | KURE-v1 (llama.cpp)  | 비권장            | Provider/모델을 바꾸면 차원과 의미 공간이 달라져 기존 벡터 전부 재생성 필요 |
  | 생성(LLM) | A.X 4.0 Light        | 쉬움(API 교체)    | 계보에 provider/model 기록만 정확히                                         |
  | OCR(VLM)  | PaddleOCR/Qwen2.5-VL | 가능(무거우면)    | 클라우드 OCR 비용, 프라이버시 고려                                          |

- **계보 연동**: 매 생성마다 `generations.provider`('llama.cpp'/'aws-bedrock')와 `models` 행(모델 id, 리전 등)을 남긴다. 로컬과 클라우드를 섞어 써도 재현과 감사가 가능하다 ([03 §4](./03-ai-outputs-and-lineage.md)).
- **설정 예**: `LLM_PROVIDER=llamacpp|bedrock`, `EMBEDDING_PROVIDER=llamacpp`(고정 권장), `BEDROCK_REGION`, `BEDROCK_LLM_MODEL_ID` 등 환경변수로 주입.

---

## 1. 폴더 트리 데이터 모델

| 방식                     | 서브트리 읽기  | MOVE(재부모)         | 재귀 삭제           | SQLAlchemy 적합    | 판정     |
| ------------------------ | -------------- | -------------------- | ------------------- | ------------------ | -------- |
| 인접 리스트(`parent_id`) | 재귀 CTE       | 1행 update           | `ON DELETE CASCADE` | 자명               | 권장     |
| 머티리얼라이즈드 패스    | `LIKE 'path%'` | 전 하위 path 재작성  | 접두 삭제           | 앱이 path 유지     | 대안     |
| ltree(확장)              | `<@` GiST      | 서브트리 path 재작성 | 접두 삭제           | 확장 설치          | MVP 과함 |
| 네스티드 셋              | 빠른 범위읽기  | 비쌈(다수 행)        | 범위삭제            | 고통               | 회피     |
| 클로저 테이블            | 단일 조인      | 클로저 재구성        | 클로저 삭제         | 추가 테이블/트리거 | 회피     |

### 결정: 인접 리스트 + 재귀 CTE

- Drive UI의 킬러 기능 MOVE = 1행 update. 머티리얼라이즈드/ltree/네스티드는 서브트리 재작성으로 여기서 무너진다.
- 재귀 삭제는 Postgres `ON DELETE CASCADE`로 앱 재귀 불필요.
- 재귀 CTE는 인덱스된 `parent_id` 위에서 충분히 빠름(DB C 코드).

```sql
CREATE TABLE folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,  -- root는 NULL
  owner_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,                                       -- 한국어명 OK(UTF-8)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_folder_sibling_name UNIQUE (parent_id, owner_id, name)
);
CREATE INDEX ix_folders_parent_id ON folders(parent_id);
```

MOVE 사이클 방지(자기 후손 아래로 이동 거부). 서비스 레이어에서 update 전 검증:

```sql
WITH RECURSIVE descendants AS (
  SELECT id FROM folders WHERE id = :folder_id
  UNION ALL
  SELECT f.id FROM folders f JOIN descendants d ON f.parent_id = d.id
)
SELECT EXISTS(SELECT 1 FROM descendants WHERE id = :new_parent_id);  -- FALSE 여야 함
```

프론트 트리 조회:

- MVP는 재귀 CTE로 평면 리스트 반환 후 React에서 트리 구성(`useMemo`).
- 낙관적 업데이트와 선택 상태가 단순해진다.
- 트리가 매우 커지면 레벨별 lazy(`WHERE parent_id=:id`).

---

## 2. 문서 스토리지 (MinIO + Postgres)

### 업로드: presigned URL (양방향)

프록시 경유는 대용량(스캔 PDF 수십~수백 MB)에서 대역폭 2배, 요청 크기 제한에 걸린다. 그래서 presigned 사용:

1. Init: `POST /documents {folder_id,filename,size,mime}`. documents 행(status=uploaded) + object_key 생성 + presigned PUT(짧은 TTL) 반환.
2. Upload: 브라우저가 MinIO로 직접 PUT.
3. Confirm: `POST /documents/{id}/complete`. stat_object 검증, status=processing, arq 파이프라인 enqueue.
4. Download: `GET /documents/{id}/download`. presigned GET(Content-Disposition에 한국어 원본명) 반환, 브라우저가 직접 fetch.

> **단일 엔드포인트**: MinIO는 원격 공인 IP 단일 엔드포인트다. 서버 SDK 호출과 브라우저 도달 URL이 동일하므로 presign을 그 단일 엔드포인트로 서명하면 된다(서버/브라우저 엔드포인트 분리 불필요).

### object key 설계: 폴더 경로와 분리

- key는 `docs/{document_id}`(무마찰) 또는 content-addressable `docs/{sha256[:2]}/{sha256}`(무료 dedup+무결성).
- 폴더 멤버십과 표시명은 Postgres에 둔다. 폴더 MOVE/rename이 MinIO를 건드리지 않는다.
- MVP는 `docs/{uuid}`, 추후 UI 변경 없이 CA로 전환.

---

## 3. 백엔드 구조 (FastAPI + async SQLAlchemy 2 + Alembic)

- 레퍼런스: `zhanymkanov/fastapi-best-practices`(도메인 모듈) + async SA2 와이어링.
- 레이어 구성:
  - router, service, repository, model 순.
  - Pydantic 스키마와 ORM 모델 분리.
  - SQL 우선(조인/집계/트리 구성은 SQL), CPU 작업은 워커로.

```
backend/
├── alembic/ (env.py: run_async_migrations; versions/)
├── src/
│   ├── main.py            # app factory, routers, CORS
│   ├── config.py          # pydantic-settings
│   ├── database.py        # async engine + async_sessionmaker + get_session
│   ├── models.py          # Base(AsyncAttrs, DeclarativeBase) + naming_convention
│   ├── folders/  {router,schemas,models,service,repository,exceptions}
│   ├── documents/{router,schemas,models,service,repository,exceptions}
│   ├── search/   {router,service}              # 하이브리드 검색
│   ├── generations/{router,schemas,models,service}  # AI 산출물 + 계보
│   ├── storage/  {minio_client,service}        # presign/stat/delete
│   ├── pipeline/ {worker,tasks}                 # arq
│   └── ai/       {provider,llama_client,bedrock_client,schemas}  # Provider 추상화
├── docker-compose.yml / Dockerfile / pyproject.toml(uv+ruff)
```

```python
# database.py 핵심
class Base(AsyncAttrs, DeclarativeBase):
    metadata = MetaData(naming_convention={
        "ix":"ix_%(column_0_label)s","uq":"uq_%(table_name)s_%(column_0_name)s",
        "fk":"fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
        "pk":"pk_%(table_name)s","ck":"ck_%(table_name)s_%(constraint_name)s"})
engine = create_async_engine(settings.DATABASE_URL)        # postgresql+psycopg://
async_session = async_sessionmaker(engine, expire_on_commit=False)
async def get_session():
    async with async_session() as s: yield s
```

- DSN은 `postgresql+psycopg`(psycopg3 async). psycopg3가 비동기를 지원하므로 asyncpg 전환 불필요. `expire_on_commit=False`. SA2 `Mapped[...]`+`mapped_column()`.
- Alembic: `alembic init -t async`(psycopg async 템플릿), `target_metadata=Base.metadata`, 모든 모델 import, 명명 규칙으로 안정적 제약명. `version_table_schema='archive'`로 버전 테이블 격리.

---

## 4. 비동기 파이프라인 + 진행 보고

- arq + Redis ([01](./01-document-processing.md) §6, [03](./03-ai-outputs-and-lineage.md) §5). BackgroundTasks 제외(상태추적, 내구성 없음).
- `documents.status`: `uploaded`, `processing`, `ready` 또는 `failed`.
- `stage`: `extracting`, `generating_meta`, `chunking`, `embedding`. 각 스테이지 멱등.
- 진행 보고: react-query 폴링.
  - `refetchInterval`로 `GET /documents/{id}` 호출, ready/failed에서 정지.
  - 업로드는 고빈도 이벤트가 아니므로 폴링이 단순하고 견고하다.
  - 푸시 원하면 SSE.

### 4b. 문서/청크/이력 스키마

```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id),
  -- 스토리지
  object_key TEXT NOT NULL UNIQUE, bucket TEXT NOT NULL,
  original_filename TEXT NOT NULL,            -- 한국어 보존
  mime_type TEXT, size_bytes BIGINT, sha256 CHAR(64),
  -- 파이프라인
  status TEXT NOT NULL DEFAULT 'uploaded', stage TEXT, error TEXT,
  -- 내재 메타
  page_count INT, author TEXT, language TEXT,  -- 'ko'
  doc_created_at TIMESTAMPTZ, doc_modified_at TIMESTAMPTZ,
  -- LLM 생성(사용자 편집 가능)
  llm_title TEXT, llm_summary TEXT, topics TEXT[], keywords TEXT[],
  content TEXT,                                -- 추출 전문(키워드 검색용; PGroonga 인덱스 대상)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_documents_folder_id ON documents(folder_id);
CREATE INDEX ix_documents_sha256 ON documents(sha256);
-- document_chunks: → 01 문서 §5.4 (vector(1024), HNSW)
-- ai_generations / generations 계보: → 03 문서 §4
```

- Pydantic v2: `ConfigDict(from_attributes=True)`, 상태는 `Literal[...]`.
- 한국어:
  - DB 인코딩 UTF-8.
  - 키워드 검색은 기본 FTS가 한국어 분절을 못하므로 PGroonga 사용 ([02](./02-search-and-rag.md) §1).

---

## 5. 프론트엔드 (Next.js 16 / React 19, 3-Panel Drive UI)

### 서버/클라이언트 분리

- `app/`는 기본 RSC, 상호작용만 `"use client"`. 파일 브라우저는 고상호작용(선택/드래그/리사이즈/낙관 CRUD).
  - **RSC**: 페이지 셸, 트리/목록 초기 패치(Suspense로 패널별 스트리밍 스켈레톤).
  - **Client**: 3패널, 트리 확장/선택, 업로드 드롭존, 메타 편집기.

### 데이터/상태

- react-query(TanStack)를 FastAPI 대상 1차 데이터 레이어로 사용한다.
  - 목록/상세/트리 + 파이프라인 폴링 + 캐시, 낙관 업데이트.
  - RSC 초기 렌더는 `HydrationBoundary`로 시드.
  - Server Actions는 선택. 이미 FastAPI가 있으므로 로직 중복 금지.
- 상태 분리:
  - 서버 데이터 = react-query.
  - 선택/확장 UI 상태 = Zustand(또는 context).
  - 트리는 평면 리스트에서 `useMemo`로 구성하여 낙관 업데이트 단순(캐시 mutate, 실패 시 롤백).

### shadcn/ui 빌딩블록

- **리사이즈 3패널**: shadcn `Resizable`(react-resizable-panels).
- **폴더 트리**: `MrLightful/shadcn-tree-view`(확장/아이콘/액션/DnD) 또는 `neigebaie/shadcn-ui-tree-view`(컨텍스트메뉴/검색/멀티선택). react-arborist는 대안.
- **업로드**: `diragb/shadcn-dropzone`를 presigned PUT에 연동.
- **아이콘**: Lucide(`Folder`,`FileText`,`Upload`…).

### 3패널과 requirement 매핑

- **Left**: 폴더 트리 + 생성/이름변경/이동/삭제(인접 리스트 CRUD).
- **Center**: 문서 목록/상세, 업로드/다운로드/삭제/이동.
- **Right**: 선택 폴더, 문서 메타데이터 + AI 생성 이력 요약(`generations` 구동, [03](./03-ai-outputs-and-lineage.md) §5).

### 반응형

- 데스크톱 3패널, 모바일 단일 패널 + Sheet/Drawer(좌 트리는 Sheet, 우 메타는 Sheet).
- Suspense로 패널별 독립 스트리밍.

---

## 6. 개발 환경 (Docker Compose + 네이티브 llama-server)

> ### Apple Silicon 핵심 주의: llama.cpp는 Docker에 넣지 말 것
>
> - macOS의 Docker 컨테이너는 Metal GPU에 접근할 수 없다.
> - llama.cpp를 Docker로 돌리면 Mac에서 GPU 가속을 못 받아 CPU로만 동작해 매우 느려진다.
> - 확정 구성: PostgreSQL과 MinIO는 원격이라 compose에 정의하지 않는다. 로컬 Docker는 Redis(+api/worker/web)만, 모델 서버(llama-server)는 Mac 호스트에서 네이티브로 실행한다.
> - Docker 안의 API는 `host.docker.internal`로 호스트의 llama-server에 접속한다.
> - 추후 AWS Bedrock으로 전환하면 이 로컬 llama-server 의존이 사라지고 Provider만 바꾸면 된다 (§0).

### 6.1 호스트에서 네이티브 실행 (Metal 가속)

```bash
# Homebrew 등으로 설치한 llama.cpp 바이너리를 Mac에서 직접 실행 (-ngl 99 = 전 레이어 Metal 오프로드)
# (1) 생성: A.X 4.0 Light, Mac 24GB 고려해 Q4_K_M 권장(00 §0.1)
llama-server -m ./models/ax-4.0-light-q4_k_m.gguf -ngl 99 -c 8192 \
  --host 127.0.0.1 --port 8080 --json-schema-file ./models/schemas/meta.json
# (2) 임베딩: KURE-v1 (전용 프로세스, 임베딩 모드)
llama-server -m ./models/kure-v1-q8_0.gguf --embeddings --pooling cls -ngl 99 \
  --ctx-size 8192 --batch-size 8192 --host 127.0.0.1 --port 8081
# (3) OCR VLM(선택): Qwen2.5-VL, 상시 X, 필요 시 llama-swap으로 온디맨드 로드/언로드
```

> 여러 모델을 24GB 안에서 번갈아 쓰려면 `llama-swap`(요청 시 해당 모델만 메모리에 올리고 TTL 후 내림)을 호스트에서 띄워 단일 엔드포인트로 묶는 것을 권장.

### 6.2 인프라는 Docker Compose

PostgreSQL과 MinIO는 원격이라 compose에 정의하지 않는다(`.env`의 `DATABASE_URL`/`MINIO_ENDPOINT`로 주입). compose는 Redis와 api/worker/web만 정의한다.

```yaml
services:
  redis: { image: redis:7-alpine, ports: ["6379:6379"] }
  api:
    build: ./backend
    command: uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
    environment:
      DATABASE_URL: postgresql+psycopg://app:app@<remote-pg>:5432/<db> # 원격, search_path=archive,archive_ext
      REDIS_URL: redis://redis:6379
      MINIO_ENDPOINT: <remote-public-ip>:9000 # 원격 단일 엔드포인트(서버와 브라우저 동일, presign 동일 URL)
      MINIO_BUCKET: <bucket>
      LLM_PROVIDER: llamacpp # 추후 bedrock 으로 교체(→ §0)
      EMBEDDING_PROVIDER: llamacpp
      LLAMA_CHAT_URL: http://host.docker.internal:8080 # ★ 호스트의 네이티브 llama-server
      LLAMA_EMBED_URL: http://host.docker.internal:8081
    extra_hosts: ["host.docker.internal:host-gateway"] # Linux 호환용(Mac은 기본 제공)
    depends_on: { redis: {} }
    ports: ["8000:8000"]
  worker: # arq 파이프라인(같은 이미지, 호스트 llama-server 접속)
    build: ./backend
    command: arq src.pipeline.worker.WorkerSettings
    environment:
      LLAMA_EMBED_URL: http://host.docker.internal:8081
    extra_hosts: ["host.docker.internal:host-gateway"]
    depends_on: [redis]
  web:
    build: ./frontend
    command: npm run dev
    environment: { NEXT_PUBLIC_API_URL: http://localhost:8000 }
    ports: ["3000:3000"]
```

- **공유 스키마 격리**: 원격은 새 DB가 아니라 공유 DB 안의 스키마로 격리한다. 테이블은 `archive`, 확장은 `archive_ext`, 연결은 `search_path=archive,archive_ext`, Alembic은 `version_table_schema='archive'`.
- **PGroonga + pgvector**: 원격 DB의 `archive_ext` 스키마에 `vector`, `pgroonga` 둘 다 활성화. 부트스트랩에서 가용성과 권한 검증 후 `CREATE EXTENSION ... SCHEMA archive_ext`. 미가용 시 의미 검색 불가(vector), 키워드 품질 저하(pgroonga 폴백 `tsvector simple`).
- 부트스트랩(앱 최초 기동 시 1회 멱등): `alembic upgrade head`(마이그레이션) + MinIO 버킷 멱등 생성 + DB 확장 활성 확인.

---

## 7. 아키텍처 권고 요약

| 주제       | 선택                                                                            |
| ---------- | ------------------------------------------------------------------------------- |
| 폴더 트리  | 인접 리스트 `parent_id` + 재귀 CTE, `ON DELETE CASCADE`, MOVE 사이클 검증       |
| 스토리지   | MinIO + presigned PUT/GET, key `docs/{uuid}`(폴더 경로 분리)                    |
| 백엔드     | 도메인 모듈, async SA2(psycopg3, `expire_on_commit=False`), Alembic async       |
| 파이프라인 | arq+Redis, status/stage 멱등                                                    |
| 진행       | react-query 폴링                                                                |
| 메타       | intrinsic+NLP+LLM, 편집가능, `ai_generations`, pgvector 청크                    |
| 프론트     | RSC 셸 + Client 패널, react-query, Zustand, shadcn Resizable+tree-view+dropzone |
| 인프라     | 원격 PG(archive/archive_ext, pgvector+PGroonga)+원격 MinIO(단일 엔드포인트), 호스트 llama×2, 로컬 Redis, api+worker, Next.js |
