---
created: 2026-06-11
updated: 2026-06-12
status: approved
overview: 도메인 전체 스키마와 Alembic 전략을 정의한다.
refs: research/01 §5.4, research/03 §4, research/04 §1·§4b
---

# 데이터 모델 & 마이그레이션

FIXME: "## 1. 범위" 삭제.
## 1. 범위
폴더·문서·청크·계보 전체 스키마와 Alembic 전략. 전용 스키마 `archive`(infrastructure §4).

## 2. 설계 결정
- 임베딩 차원 **1024** 전 시스템 통일, HNSW cosine.
  - HNSW: 근사 최근접 이웃(ANN) 벡터 인덱스(Hierarchical Navigable Small World)
  - cosine: 코사인 유사도 기준 거리(`vector_cosine_ops`).
- 계보는 행 단위 스냅샷(W3C PROV/Langfuse 정렬) — 모델/템플릿 변경이 과거 기록 미오염.
  - W3C PROV: 출처(provenance) 표현용 W3C 표준 데이터 모델
  - Langfuse: LLM 호출 추적·관측 플랫폼
  - 두 방식의 계보 표현(누가·무엇으로·무엇을 생성했나)에 맞춰 설계.
- 원격 공유 PostgreSQL DB(타 서비스와 같은 DB 공유, infrastructure §4) 안의 전용 스키마 `archive`에 테이블 격리, 확장은 같은 DB의 `public` 스키마.
- `users`: MVP는 인증 범위 밖 → 최소 `users(id, created_at)` + 시드 1명, `owner_id`는 향후 멀티테넌트 대비 강제.
  - 멀티테넌트(multi-tenant): 한 시스템 인스턴스를 여러 사용자·조직(테넌트)이 공유하되 데이터는 `owner_id`로 상호 격리하는 구조.

## 3. 관계 (ERD 대용)
- `users` 1—N `folders` (owns).
- `users` 1—N `documents` (owns).
- `folders` 1—N `folders` (self, parent).
- `folders` 1—N `documents` (contains).
- `documents` 1—N `document_chunks`.
- `generations` 1—N `generation_prompts`.
- `generations` 1—N `generation_source_documents`.
- `generations` 1—N `generation_source_chunks`.
- `generations` 1—N `generation_charts`.
- `generations` N—1 `models`.
- `generations` N—1 `prompt_templates`.
- `generations` ↔ `documents`는 두 종류의 관계:
  - 입력(출처): `generations` N—M `documents` (`generation_source_documents` 경유) — 한 생성이 여러 원본을 섞으면 다대다.
  - 출력(산출물): `generations` 0—1 `documents` (`output_document_id`, materialize) — 생성 1회당 산출 문서 최대 1개, materialize 전이면 0.

## 4. 테이블 DDL (요약, 스키마=archive)

### folders (인접 리스트)
```sql
CREATE TABLE archive.folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES archive.folders(id) ON DELETE CASCADE,  -- root=NULL
  owner_id UUID NOT NULL REFERENCES archive.users(id),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_folder_sibling_name UNIQUE (parent_id, owner_id, name)
);
CREATE INDEX ix_folders_parent_id ON archive.folders(parent_id);
```

### documents
```sql
CREATE TABLE archive.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id UUID REFERENCES archive.folders(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES archive.users(id),
  object_key TEXT NOT NULL UNIQUE, bucket TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT, size_bytes BIGINT, sha256 CHAR(64),
  status TEXT NOT NULL DEFAULT 'uploaded', stage TEXT, error TEXT,
  page_count INT, author TEXT, language TEXT,
  doc_created_at TIMESTAMPTZ, doc_modified_at TIMESTAMPTZ,
  -- AI 생성 메타(MVP 읽기 전용 표시; 사용자 보정 제외)
  llm_title TEXT, llm_summary TEXT, topics TEXT[], keywords TEXT[],
  content TEXT,                                  -- PGroonga 인덱스 대상
  ingest_ms INT,                                 -- 인제스트 소요(ms), 성능 표시용
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),  -- 등록일(화면 노출 기준)
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()   -- 내부 감사용(화면 미노출)
);
CREATE INDEX ix_documents_folder_id ON archive.documents(folder_id);
CREATE INDEX ix_documents_sha256 ON archive.documents(sha256);
CREATE INDEX ix_documents_content_pgroonga ON archive.documents USING pgroonga (content);
```

### document_chunks (벡터)
```sql
CREATE TABLE archive.document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES archive.documents(id) ON DELETE CASCADE,
  parent_doc_id UUID,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL, context TEXT,
  metadata JSONB,
  embedding vector(1024) NOT NULL,
  UNIQUE (document_id, chunk_index)
);
CREATE INDEX ix_chunks_hnsw ON archive.document_chunks
  USING hnsw (embedding vector_cosine_ops) WITH (m=16, ef_construction=200);
CREATE INDEX ix_chunks_metadata ON archive.document_chunks USING gin (metadata);
```

### 계보 (요약 — 상세 운용은 ai-outputs)
```sql
CREATE TYPE archive.artifact_kind AS ENUM ('summary','draft','report');
CREATE TYPE archive.gen_method  AS ENUM ('stuff','map_reduce','refine','hierarchical','outline_expand','template_fill');
CREATE TYPE archive.job_status  AS ENUM ('queued','running','succeeded','failed','canceled');

CREATE TABLE archive.models (            -- 정적 레지스트리
  id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL,
  file_path TEXT, file_sha256 TEXT, quantization TEXT, context_window INT,
  provider TEXT NOT NULL DEFAULT 'llama.cpp', runtime_build TEXT,
  created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE archive.prompt_templates (
  id BIGSERIAL PRIMARY KEY, key TEXT NOT NULL, version INT NOT NULL,
  language TEXT DEFAULT 'ko', body TEXT NOT NULL, UNIQUE (key, version));
CREATE TABLE archive.generations (       -- 계보 헤드(=생성 1회)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind archive.artifact_kind NOT NULL, method archive.gen_method,
  status archive.job_status NOT NULL DEFAULT 'queued',
  user_id UUID REFERENCES archive.users(id),
  model_id BIGINT REFERENCES archive.models(id), provider TEXT,
  temperature REAL, top_p REAL, top_k INT, seed BIGINT,
  max_tokens INT, decode_params JSONB,
  embedding_model TEXT, retrieval_k INT, retrieval_params JSONB,
  prompt_tokens INT, completion_tokens INT, total_tokens INT, latency_ms INT,  -- latency_ms=생성 소요
  output_text TEXT, output_meta JSONB, error TEXT,
  -- 산출물을 1급 문서로 materialize한 결과 문서. 문서 삭제 시 SET NULL → "산출물 내역" 비노출.
  output_document_id UUID REFERENCES archive.documents(id) ON DELETE SET NULL,
  progress_pct INT DEFAULT 0, progress_step TEXT,
  created_at TIMESTAMPTZ DEFAULT now(), started_at TIMESTAMPTZ, finished_at TIMESTAMPTZ);
CREATE TABLE archive.generation_prompts (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID REFERENCES archive.generations(id) ON DELETE CASCADE,
  step TEXT, step_index INT, template_id BIGINT REFERENCES archive.prompt_templates(id),
  rendered_prompt TEXT NOT NULL, rendered_system TEXT, raw_response TEXT);
CREATE TABLE archive.generation_source_documents (
  generation_id UUID REFERENCES archive.generations(id) ON DELETE CASCADE,
  document_id UUID REFERENCES archive.documents(id), role TEXT,
  PRIMARY KEY (generation_id, document_id));
CREATE TABLE archive.generation_source_chunks (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID REFERENCES archive.generations(id) ON DELETE CASCADE,
  chunk_id UUID REFERENCES archive.document_chunks(id),
  document_id UUID REFERENCES archive.documents(id),
  citation_index INT, retrieval_rank INT, similarity REAL, used_in_step TEXT);
CREATE TABLE archive.generation_charts (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID REFERENCES archive.generations(id) ON DELETE CASCADE,
  title TEXT, spec_format TEXT DEFAULT 'vega-lite', spec JSONB NOT NULL,
  data_rows JSONB, computed_stats JSONB, valid BOOLEAN, repair_attempts INT DEFAULT 0);
```

## 5. 명명 규약 & Base
- SQLAlchemy `MetaData(naming_convention={ix,uq,fk,pk,ck})`, `Mapped[]`+`mapped_column()`.
- Pydantic v2 `ConfigDict(from_attributes=True)`, 상태는 `Literal[...]`.

## 6. PostgreSQL DB 확장 의존 & 격리
- `vector` — 임베딩 저장·HNSW. 미가용 시 의미 검색 불가.
- `pgroonga` — 한국어 키워드 검색. 미가용 시 `tsvector simple` 폴백(품질↓).
- 확장은 `public`, 테이블은 `archive`. §9 가용성 검증 선행.

## 7. Alembic 전략
- `alembic init -t async`로 비동기 템플릿 기반 Alembic을 초기화하고, `target_metadata=Base.metadata`로 변경 자동감지(autogenerate)가 비교할 기준 스키마를 지정한다. 이때 모든 모델 모듈을 import 해둬야 autogenerate가 테이블을 빠짐없이 인식한다.
- 확장(`CREATE EXTENSION`)·특수 인덱스(HNSW·PGroonga 인덱스 객체)·ENUM 타입은 autogenerate가 자동 생성하지 못하거나 잘못 만든다 → 마이그레이션 스크립트에서 사람이 직접 `op.execute("CREATE INDEX ... USING hnsw ...")` 식으로 작성("수동 마이그레이션").
- `version_table_schema='archive'` — Alembic이 적용 이력을 기록하는 `alembic_version` 테이블도 `public`이 아닌 `archive` 스키마에 둬 격리한다. 적용은 원격 DB 대상 `alembic upgrade head`(최신까지 전진), 되돌림은 `alembic downgrade`(이전 리비전으로 후퇴).

## 8. 무결성·삭제 정책
- CASCADE DELETE
  - `folders` → 하위 `folders` / `documents` → `document_chunks`.
  - 계보 하위 테이블도 `generations` CASCADE.
  - documents의 MinIO 오브젝트는 앱/worker가 별도 삭제.
- 출처(source) 문서 삭제 보호 (미해결)
  - `generation_source_documents.document_id`·`generation_source_chunks.chunk_id` FK는 현재 `ON DELETE` 미지정(=NO ACTION).
  - 어떤 생성의 출처로 인용된 원본·청크는 삭제가 **차단**된다 → 산출물 계보가 "깨지는" 게 아니라 원본 삭제 자체가 거부됨. 정책 확정은 §9.

## 9. 운영 배포 전 TODO
- 확장 가용성·`CREATE` 권한 (선행 필수)
  - 해결: [ ]
  - 비고: 배포 전 아래 SQL로 가용성·권한 검증, 권한 거부 시 DBA에 사전 설치 요청.
    ```sql
    SELECT * FROM pg_available_extensions WHERE name IN ('vector','pgroonga');
    CREATE EXTENSION IF NOT EXISTS vector;
    CREATE EXTENSION IF NOT EXISTS pgroonga;
    ```
  - 미가용 영향: `vector` 없으면 의미 검색 불가, `pgroonga` 없으면 한국어 키워드 품질 저하(폴백 `tsvector simple`).
- HNSW 빌드 비용
  - 해결: [ ]
  - 비고: 원격 리소스 여유 확인.
- 출처 문서 삭제 시 계보 정책 (§8 참조)
  - 해결: [ ]
  - 비고:
    - 현재 source FK가 NO ACTION이라 출처로 인용된 원본 삭제가 차단됨
    - 권장: source FK를 `ON DELETE SET NULL`로 바꾸고 `document_id`/`chunk_id` nullable + 인용 텍스트 스냅샷 보존 → 원본 삭제해도 계보 유지. 확정 후 DDL 반영.
