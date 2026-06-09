# 04. 시스템 아키텍처 · 데이터 모델 · 프론트엔드 · 인프라

> ### 💡 이 문서를 읽기 전에 (핵심 용어)
> 이 문서는 **AI를 처음 배우는 개발자**도 따라올 수 있게 작성했다. 모르는 용어는 [용어집](./06-glossary.md)에서 찾자.
> - **인접 리스트 / 재귀 CTE**: 폴더 트리를 저장·조회하는 방법(부모 id만 기억 / SQL로 트리 전체 훑기).
> - **presigned URL**: 브라우저가 서버를 거치지 않고 파일 저장소(MinIO)에 직접 올리고 받는 임시 서명 링크.
> - **작업 큐(arq)·멱등성**: 무거운 처리를 백그라운드로 줄 세우는 장치 / 재시도해도 중복이 안 생기는 성질.
> - **RSC / 클라이언트 컴포넌트**: Next.js에서 서버 렌더 컴포넌트 / 브라우저 상호작용 컴포넌트.
> - **Provider 추상화**: AI 모델을 로컬(llama.cpp)에서 돌릴지 클라우드(AWS Bedrock)에서 돌릴지 교체 가능하게 하는 설계.
>
> 더 자세한 정의는 [용어집](./06-glossary.md) 참고.

requirement TODO 해소: 레이아웃(3-Panel), 폴더/문서 CRUD, 전체 데이터 모델, 인프라.
기술 스택은 고정(Next.js 16/React 19/TS/Tailwind 4/shadcn/Lucide · FastAPI/Pydantic v2/SQLAlchemy 2/Alembic · PostgreSQL+pgvector · MinIO · llama.cpp).
배포 전제: **로컬 = Mac mini(M4) + 24GB 통합 메모리**, **추후 일부 모델 = AWS Bedrock**(→ [00 §0](./00-summary-and-decisions.md)).

---

## 0. Provider 추상화 (로컬 llama.cpp ↔ 추후 AWS Bedrock)

> **왜 필요한가(초보자 설명):** AI 모델은 *내 컴퓨터에서 직접*(llama.cpp) 돌릴 수도, *클라우드 API*(AWS Bedrock)로 빌려 쓸 수도 있다. 이 "어디서 돌리는가"를 **Provider**라 한다. 지금은 로컬이 기본이지만, 나중에 더 강력한 모델이 필요할 때 코드를 갈아엎지 않고 갈아끼울 수 있도록 **인터페이스로 추상화**해 둔다.

- **인터페이스 분리:** 비즈니스 로직(요약/검색/추출)은 구체 Provider가 아니라 추상 인터페이스에만 의존한다.
  ```python
  class LLMClient(Protocol):
      async def generate(self, *, system: str, prompt: str,
                         params: DecodeParams, json_schema: dict | None = None) -> LLMResult: ...
  class EmbeddingClient(Protocol):
      async def embed(self, texts: list[str]) -> list[list[float]]: ...

  # 구현체 (설정으로 선택)
  class LlamaCppLLM(LLMClient): ...      # llama-server /v1/chat/completions (로컬, Metal)
  class BedrockLLM(LLMClient): ...       # AWS Bedrock (예: Claude) — 추후
  class LlamaCppEmbedding(EmbeddingClient): ...   # KURE-v1 (로컬)
  ```
- **무엇을 어디로 보낼지 (권장 정책):**
  | 역할 | MVP(로컬) | 추후 Bedrock 전환 | 주의 |
  |---|---|---|---|
  | 임베딩 | KURE-v1 (llama.cpp) | **비권장** | Provider/모델을 바꾸면 **차원·의미 공간이 달라져 기존 벡터 전부 재생성** 필요 |
  | 생성(LLM) | A.X 4.0 Light | 쉬움(API 교체) | 계보에 provider/model 기록만 정확히 |
  | OCR(VLM) | PaddleOCR/Qwen2.5-VL | 가능(무거우면) | 클라우드 OCR 비용·프라이버시 고려 |
- **계보 연동:** 매 생성마다 `generations.provider`('llama.cpp'/'aws-bedrock')와 `models` 행(모델 id·리전 등)을 남겨, 로컬·클라우드를 섞어 써도 **재현·감사 가능**(→ [03 §4](./03-ai-outputs-and-lineage.md)).
- **설정 예:** `LLM_PROVIDER=llamacpp|bedrock`, `EMBEDDING_PROVIDER=llamacpp`(고정 권장), `BEDROCK_REGION`, `BEDROCK_LLM_MODEL_ID` 등 환경변수로 주입.

---

## 1. 폴더 트리 데이터 모델

| 방식 | 서브트리 읽기 | **MOVE(재부모)** | 재귀 삭제 | SQLAlchemy 적합 | 판정 |
|---|---|---|---|---|---|
| **인접 리스트(`parent_id`)** | 재귀 CTE | **1행 update** | `ON DELETE CASCADE` | 자명 | **권장** |
| 머티리얼라이즈드 패스 | `LIKE 'path%'` | 전 하위 path 재작성 | 접두 삭제 | 앱이 path 유지 | 대안 |
| ltree(확장) | `<@` GiST | 서브트리 path 재작성 | 접두 삭제 | 확장 설치 | MVP 과함 |
| 네스티드 셋 | 빠른 범위읽기 | **비쌈(다수 행)** | 범위삭제 | 고통 | 회피 |
| 클로저 테이블 | 단일 조인 | 클로저 재구성 | 클로저 삭제 | 추가 테이블/트리거 | 회피 |

### 결정 — **인접 리스트 + 재귀 CTE**
- Drive UI의 킬러 기능 **MOVE = 1행 update**. 머티리얼라이즈드/ltree/네스티드는 서브트리 재작성으로 여기서 무너짐.
- 재귀 삭제는 Postgres `ON DELETE CASCADE`로 앱 재귀 불필요. 재귀 CTE는 인덱스된 `parent_id` 위에서 충분히 빠름(DB C 코드).

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

**MOVE 사이클 방지**(자기 후손 아래로 이동 거부) — 서비스 레이어에서 update 전 검증:
```sql
WITH RECURSIVE descendants AS (
  SELECT id FROM folders WHERE id = :folder_id
  UNION ALL
  SELECT f.id FROM folders f JOIN descendants d ON f.parent_id = d.id
)
SELECT EXISTS(SELECT 1 FROM descendants WHERE id = :new_parent_id);  -- FALSE 여야 함
```

**프론트 트리 조회:** MVP는 재귀 CTE로 **평면 리스트** 반환 후 React에서 트리 구성(`useMemo`). 낙관적 업데이트·선택 상태가 단순해짐. 트리가 매우 커지면 레벨별 lazy(`WHERE parent_id=:id`).

---

## 2. 문서 스토리지 (MinIO + Postgres)

### 업로드 — presigned URL (양방향)
프록시 경유는 대용량(스캔 PDF 수십~수백 MB)에서 대역폭 2배·요청 크기 제한에 걸림 → **presigned**:

```
1. Init    POST /documents {folder_id,filename,size,mime} → documents 행(status=uploaded) + object_key 생성 + presigned PUT(짧은 TTL) 반환
2. Upload  브라우저 → MinIO 직접 PUT
3. Confirm POST /documents/{id}/complete → stat_object 검증 → status=processing → arq 파이프라인 enqueue
4. Download GET /documents/{id}/download → presigned GET(Content-Disposition에 한국어 원본명) → 브라우저 직접 fetch
```

> **Docker 함정:** presigned URL에 MinIO 엔드포인트 호스트가 박힘. 컨테이너 내부명(`minio:9000`)은 브라우저에서 해석 불가 → **브라우저 도달 가능 엔드포인트(`localhost:9000`)로 서명**, 서버측 SDK 호출은 내부명.

### object key 설계 — 폴더 경로와 분리
- key는 `docs/{document_id}`(무마찰) 또는 content-addressable `docs/{sha256[:2]}/{sha256}`(무료 dedup+무결성). 폴더 멤버십·표시명은 Postgres → **폴더 MOVE/rename이 MinIO를 건드리지 않음**.
- MVP는 `docs/{uuid}`, 추후 UI 변경 없이 CA로 전환.

---

## 3. 백엔드 구조 (FastAPI + async SQLAlchemy 2 + Alembic)

- 레퍼런스: `zhanymkanov/fastapi-best-practices`(도메인 모듈) + async SA2 와이어링.
- 레이어: **router → service → repository → model**, Pydantic 스키마와 ORM 모델 분리. SQL 우선(조인/집계/트리 구성은 SQL), CPU 작업은 워커로.

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
│   └── pipeline/ {worker,tasks,llama_client}    # arq
├── docker-compose.yml / Dockerfile / pyproject.toml(uv+ruff)
```

```python
# database.py 핵심
class Base(AsyncAttrs, DeclarativeBase):
    metadata = MetaData(naming_convention={
        "ix":"ix_%(column_0_label)s","uq":"uq_%(table_name)s_%(column_0_name)s",
        "fk":"fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
        "pk":"pk_%(table_name)s","ck":"ck_%(table_name)s_%(constraint_name)s"})
engine = create_async_engine(settings.DATABASE_URL)        # postgresql+asyncpg://
async_session = async_sessionmaker(engine, expire_on_commit=False)
async def get_session():
    async with async_session() as s: yield s
```
- **`postgresql+asyncpg`** 필수(드라이버 틀리면 이벤트루프 블록). `expire_on_commit=False`. SA2 `Mapped[...]`+`mapped_column()`.
- Alembic: `alembic init -t async`, `target_metadata=Base.metadata`, 모든 모델 import, 명명 규칙으로 안정적 제약명.

---

## 4. 비동기 파이프라인 + 진행 보고

- **arq + Redis**(→ [01](./01-document-processing.md) §6, [03](./03-ai-outputs-and-lineage.md) §5). BackgroundTasks 제외(상태추적·내구성 없음).
- `documents.status`: `uploaded→processing→ready|failed`, `stage`: `extracting→generating_meta→chunking→embedding`, 각 스테이지 멱등.
- **진행 보고: react-query 폴링**(`refetchInterval`로 `GET /documents/{id}`, ready/failed에서 정지). 업로드는 고빈도 이벤트 아님 → 폴링이 단순·견고. 푸시 원하면 SSE.

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
- **한국어:** DB 인코딩 UTF-8. 키워드 검색은 기본 FTS가 한국어 분절을 못하므로 **PGroonga**(→ [02](./02-search-and-rag.md) §1).

---

## 5. 프론트엔드 (Next.js 16 / React 19, 3-Panel Drive UI)

### 서버/클라이언트 분리
- `app/`는 기본 RSC, 상호작용만 `"use client"`. 파일 브라우저는 고상호작용(선택/드래그/리사이즈/낙관 CRUD).
  - **RSC:** 페이지 셸, 트리·목록 초기 패치(Suspense로 패널별 스트리밍 스켈레톤).
  - **Client:** 3패널, 트리 확장/선택, 업로드 드롭존, 메타 편집기.

### 데이터/상태
- **react-query(TanStack)** 를 FastAPI 대상 1차 데이터 레이어로(목록/상세/트리 + 파이프라인 폴링 + 캐시·낙관 업데이트). RSC 초기 렌더는 `HydrationBoundary`로 시드. Server Actions는 선택(이미 FastAPI 있음 — 로직 중복 금지).
- 서버 데이터=react-query, **선택/확장 UI 상태=Zustand**(또는 context). 트리는 평면 리스트에서 `useMemo` 구성 → 낙관 업데이트 단순(캐시 mutate, 실패 시 롤백).

### shadcn/ui 빌딩블록
- **리사이즈 3패널:** shadcn `Resizable`(react-resizable-panels).
- **폴더 트리:** `MrLightful/shadcn-tree-view`(확장/아이콘/액션/DnD) 또는 `neigebaie/shadcn-ui-tree-view`(컨텍스트메뉴/검색/멀티선택). react-arborist는 대안.
- **업로드:** `diragb/shadcn-dropzone` → presigned PUT 연동.
- **아이콘:** Lucide(`Folder`,`FileText`,`Upload`…).

### 3패널 ↔ requirement 매핑
- **Left:** 폴더 트리 + 생성/이름변경/이동/삭제(인접 리스트 CRUD).
- **Center:** 문서 목록/상세, 업로드/다운로드/삭제/이동.
- **Right:** 선택 폴더·문서 메타데이터 + **AI 생성 이력 요약**(`generations` 구동 → [03](./03-ai-outputs-and-lineage.md) §5).

### 반응형
데스크톱 3패널 → 모바일 단일 패널 + Sheet/Drawer(좌 트리→Sheet, 우 메타→Sheet). Suspense로 패널별 독립 스트리밍.

---

## 6. 개발 환경 (Docker Compose + 네이티브 llama-server)

> ### ⚠️ Apple Silicon 핵심 주의 — llama.cpp는 Docker에 넣지 말 것
> **macOS의 Docker 컨테이너는 Metal GPU에 접근할 수 없다.** llama.cpp를 Docker로 돌리면 Mac에서 **GPU 가속을 못 받아 CPU로만** 동작해 매우 느려진다.
> 따라서 권장 구성은: **인프라(Postgres·MinIO·Redis)는 Docker로, 모델 서버(llama-server)는 Mac 호스트에서 네이티브로** 실행하고, Docker 안의 API는 `host.docker.internal`로 호스트의 llama-server에 접속한다.
> (추후 AWS Bedrock으로 전환하면 이 로컬 llama-server 의존이 사라지고 Provider만 바꾸면 된다 → §0.)

### 6.1 호스트에서 네이티브 실행 (Metal 가속)
```bash
# Homebrew 등으로 설치한 llama.cpp 바이너리를 Mac에서 직접 실행 (-ngl 99 = 전 레이어 Metal 오프로드)
# (1) 생성: A.X 4.0 Light  — Mac 24GB 고려해 Q4_K_M 권장(→ 00 §0.1)
llama-server -m ./models/ax-4.0-light-q4_k_m.gguf -ngl 99 -c 8192 \
  --host 127.0.0.1 --port 8080 --json-schema-file ./models/schemas/meta.json
# (2) 임베딩: KURE-v1 (전용 프로세스, 임베딩 모드)
llama-server -m ./models/kure-v1-q8_0.gguf --embeddings --pooling cls -ngl 99 \
  --ctx-size 8192 --batch-size 8192 --host 127.0.0.1 --port 8081
# (3) OCR VLM(선택): Qwen2.5-VL — 상시 X, 필요 시 llama-swap으로 온디맨드 로드/언로드
```
> 여러 모델을 24GB 안에서 번갈아 쓰려면 **`llama-swap`**(요청 시 해당 모델만 메모리에 올리고 TTL 후 내림)을 호스트에서 띄워 단일 엔드포인트로 묶는 것을 권장.

### 6.2 인프라는 Docker Compose
```yaml
services:
  db:
    image: groonga/pgroonga:latest-alpine-17   # PGroonga 포함 이미지(pgvector도 함께 설치 필요 → 아래 주의)
    environment: {POSTGRES_USER: app, POSTGRES_PASSWORD: app, POSTGRES_DB: archive}
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
    healthcheck: {test: ["CMD","pg_isready","-U","app"], interval: 5s, retries: 10}
  redis: {image: redis:7-alpine, ports: ["6379:6379"]}
  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment: {MINIO_ROOT_USER: minio, MINIO_ROOT_PASSWORD: minio123}
    ports: ["9000:9000","9001:9001"]     # 9000 브라우저 도달 가능해야 함(presigned)
    volumes: ["miniodata:/data"]
  api:
    build: ./backend
    command: uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
    environment:
      DATABASE_URL: postgresql+asyncpg://app:app@db:5432/archive
      REDIS_URL: redis://redis:6379
      MINIO_INTERNAL_ENDPOINT: minio:9000
      MINIO_PUBLIC_ENDPOINT: localhost:9000        # presign은 이걸로
      LLM_PROVIDER: llamacpp                        # 추후 bedrock 으로 교체(→ §0)
      EMBEDDING_PROVIDER: llamacpp
      LLAMA_CHAT_URL: http://host.docker.internal:8080   # ★ 호스트의 네이티브 llama-server
      LLAMA_EMBED_URL: http://host.docker.internal:8081
    extra_hosts: ["host.docker.internal:host-gateway"]   # Linux 호환용(Mac은 기본 제공)
    depends_on: {db: {condition: service_healthy}, redis: {}, minio: {}}
    ports: ["8000:8000"]
  worker:                                # arq 파이프라인(같은 이미지, 호스트 llama-server 접속)
    build: ./backend
    command: arq src.pipeline.worker.WorkerSettings
    environment:
      LLAMA_EMBED_URL: http://host.docker.internal:8081
    extra_hosts: ["host.docker.internal:host-gateway"]
    depends_on: [db, redis, minio]
  web:
    build: ./frontend
    command: npm run dev
    environment: {NEXT_PUBLIC_API_URL: http://localhost:8000}
    ports: ["3000:3000"]
volumes: {pgdata: , miniodata: }
```
- **PGroonga + pgvector 한 DB:** 둘 다 필요한데 단일 공식 이미지는 없다. (a) `groonga/pgroonga` 이미지에 pgvector를 추가 설치하거나 (b) 두 확장이 모두 든 **커스텀 이미지를 빌드**(권장). **인프라 결정 포인트.** `CREATE EXTENSION vector; CREATE EXTENSION pgroonga;` 둘 다 활성화.
- 부트 시 `mc mb`(MinIO 버킷 생성) + `alembic upgrade head`(마이그레이션) 일회성 잡 실행.
- **대안:** 빠른 시작을 원하면 인프라까지 전부 로컬 설치(Postgres+pgvector+PGroonga, MinIO, Redis를 Homebrew)해도 된다. 핵심은 **llama-server만큼은 네이티브(Metal)** 라는 점.

---

## 7. 아키텍처 권고 요약

| 주제 | 선택 |
|---|---|
| 폴더 트리 | 인접 리스트 `parent_id` + 재귀 CTE, `ON DELETE CASCADE`, MOVE 사이클 검증 |
| 스토리지 | MinIO + presigned PUT/GET, key `docs/{uuid}`(폴더 경로 분리) |
| 백엔드 | 도메인 모듈, async SA2(asyncpg, `expire_on_commit=False`), Alembic async |
| 파이프라인 | arq+Redis, status/stage 멱등 |
| 진행 | react-query 폴링 |
| 메타 | intrinsic+NLP+LLM, 편집가능, `ai_generations`, pgvector 청크 |
| 프론트 | RSC 셸 + Client 패널, react-query, Zustand, shadcn Resizable+tree-view+dropzone |
| 인프라 | pgvector+PGroonga DB, MinIO, llama×2, Redis, api+worker, Next.js |
