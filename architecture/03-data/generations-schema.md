---
created: 2026-06-12
updated: 2026-06-12
status: approved
overview: 생성 계보(generations 헤드 + 하위 테이블) 스키마와 출처 삭제 정책을 정의한다.
refs: research/03 §4, research/04 §4b
---

# 생성 계보 스키마

## 1. 테이블 DDL (요약, 스키마=archive)
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

## 2. 무결성·삭제 정책
- 생성 삭제 → 하위 계보 연쇄 삭제
  - `generations` 한 행을 삭제하면, 그 생성을 가리키는(`generation_id` FK) 모든 하위 행 — `generation_prompts`·`generation_source_documents`·`generation_source_chunks`·`generation_charts` — 이 `ON DELETE CASCADE`로 자동 삭제된다.
  - 즉 생성 1회 기록을 지우면 그 프롬프트·출처·차트 계보가 통째로 사라진다.
- 산출물 문서 삭제 → 헤드는 유지, 링크만 끊김
  - 산출물로 materialize된 `documents` 행이 삭제되면, 이를 가리키던 `generations.output_document_id`가 `ON DELETE SET NULL`로 NULL이 된다.
  - `generations` 헤드 행 자체는 남고 "산출물 내역"에서만 비노출된다.
- 출처(source) 문서 삭제 보호 (미해결)
  - `generation_source_documents.document_id`·`generation_source_chunks.chunk_id` FK는 현재 `ON DELETE` 미지정(=NO ACTION).
  - 어떤 생성의 출처로 인용된 원본 `documents`·`document_chunks` 행을 삭제하려 하면 이 FK 때문에 삭제가 **차단**된다 → 산출물 계보가 "깨지는" 게 아니라 원본 삭제 자체가 거부됨. 정책 확정은 §3.

## 3. 운영 배포 전 TODO
- 출처 문서 삭제 시 계보 정책 (§2 참조)
  - 해결: [ ]
  - 비고:
    - 문제
      - 출처 FK(`generation_source_documents.document_id`·`generation_source_chunks.chunk_id`)가 현재 `ON DELETE` 미지정
      - 한 번이라도 어떤 생성의 출처로 인용된 원본 문서·청크는 그 인용 행이 참조를 잡고 있어 삭제가 거부된다.
      - 즉 사용자가 보관함에서 원본 문서를 지울 수 없는 상태가 된다.
    - 권장 방향
      - 출처 FK를 `ON DELETE SET NULL`로 바꾸고 `document_id`/`chunk_id` 컬럼을 nullable로 만든다.
      - 원본을 삭제해도 인용 행 자체는 남고, 그 행의 `document_id`/`chunk_id`만 NULL이 된다.
      - 결과적으로 "원본은 이제 없음" 상태로 표시된다.
    - 인용 텍스트 스냅샷 보존 방법
      - FK만 끊으면 "무엇을 인용했는지"가 사라진다.
      - 그래서 생성 시점에 인용한 청크 본문(필요 시 문서 제목·메타도)을 인용 행에 **그대로 복사해 두는 비정규화 컬럼**을 추가한다.
        - 예: `generation_source_chunks.cited_text TEXT` (선택적으로 `cited_title TEXT`·`cited_metadata JSONB`).
      - 이 컬럼은 생성 시 `document_chunks.content` 값을 읽어 인용 행에 저장한다.
      - 따라서 원본 청크가 나중에 삭제돼도(=`chunk_id` NULL) 인용 행 안에 본문 사본이 남아 계보·근거 추적이 유지된다.
    - 확정 후 DDL 반영
      - 스냅샷 컬럼 추가.
      - 출처 FK `ON DELETE SET NULL`로 변경.
      - `document_id`/`chunk_id` nullable 마이그레이션.
