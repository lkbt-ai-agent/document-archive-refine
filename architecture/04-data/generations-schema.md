---
created: 2026-06-12
updated: 2026-06-12
status: approved
overview: 생성 계보(generations 헤드 + 하위 테이블) 스키마와 출처 삭제 정책을 정의한다.
refs: research/01-mvp-research/03 §4, research/01-mvp-research/04 §4b
---

# 생성 계보 스키마

## 1. 테이블 DDL (요약, 스키마=archive)
```sql
CREATE TYPE archive.artifact_kind AS ENUM ('summary','draft','report');  -- 산출물 종류
CREATE TYPE archive.gen_method AS ENUM ('stuff','map_reduce','hierarchical','outline_expand','report_pipeline');  -- 생성 방식
CREATE TYPE archive.job_status AS ENUM ('queued','running','succeeded','failed');  -- 작업 상태

CREATE TABLE archive.models (                              -- 모델 레지스트리(정적)
  id             BIGSERIAL PRIMARY KEY,                    -- 모델 ID
  name           TEXT NOT NULL,                            -- 모델명
  file_path      TEXT,                                     -- 모델 파일 경로
  file_sha256    TEXT,                                     -- 모델 파일 해시
  quantization   TEXT,                                     -- 양자화
  context_window INT,                                      -- 컨텍스트 윈도우
  provider       TEXT NOT NULL DEFAULT 'llama.cpp',        -- 프로바이더
  runtime_build  TEXT,                                     -- 런타임 빌드
  created_at     TIMESTAMPTZ DEFAULT now());               -- 생성 일시

CREATE TABLE archive.prompt_templates (                    -- 프롬프트 템플릿
  id       BIGSERIAL PRIMARY KEY,                          -- 템플릿 ID
  key      TEXT NOT NULL,                                  -- 템플릿 키
  version  INT NOT NULL,                                   -- 버전
  language TEXT DEFAULT 'ko',                              -- 언어
  body     TEXT NOT NULL,                                  -- 템플릿 본문
  UNIQUE (key, version));

CREATE TABLE archive.generations (                         -- 계보 헤드(=생성 1회)
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- 생성 ID
  kind               archive.artifact_kind NOT NULL,        -- 산출물 종류
  method             archive.gen_method,                    -- 생성 방식
  status             archive.job_status NOT NULL DEFAULT 'queued',  -- 작업 상태
  user_id            UUID REFERENCES archive.users(id),     -- 사용자 ID
  model_id           BIGINT REFERENCES archive.models(id),  -- 모델 ID
  provider           TEXT,                                  -- 프로바이더
  temperature        REAL,                                  -- 디코딩 temperature
  top_p              REAL,                                  -- 디코딩 top_p
  top_k              INT,                                   -- 디코딩 top_k
  seed               BIGINT,                                -- 시드
  max_tokens         INT,                                   -- 최대 토큰
  decode_params      JSONB,                                 -- 디코딩 파라미터(기타)
  embedding_model    TEXT,                                  -- 임베딩 모델
  retrieval_k        INT,                                   -- 검색 k
  retrieval_params   JSONB,                                 -- 검색 파라미터
  prompt_tokens      INT,                                   -- 프롬프트 토큰 수
  completion_tokens  INT,                                   -- 출력 토큰 수
  total_tokens       INT,                                   -- 총 토큰 수
  latency_ms         INT,                                   -- 생성 소요(ms)
  output_text        TEXT,                                  -- 산출물 텍스트
  output_meta        JSONB,                                 -- 산출물 메타
  error              TEXT,                                  -- 오류 메시지
  output_document_id UUID REFERENCES archive.documents(id) ON DELETE SET NULL,  -- 산출물 문서 ID(materialize 결과)
  progress_pct       INT DEFAULT 0,                         -- 진행률(%)
  progress_step      TEXT,                                  -- 진행 단계
  created_at         TIMESTAMPTZ DEFAULT now(),             -- 생성 일시
  started_at         TIMESTAMPTZ,                           -- 시작 일시
  finished_at        TIMESTAMPTZ);                          -- 종료 일시

CREATE TABLE archive.generation_prompts (                  -- 생성 프롬프트 기록
  id              BIGSERIAL PRIMARY KEY,                    -- 프롬프트 ID
  generation_id   UUID REFERENCES archive.generations(id) ON DELETE CASCADE,  -- 생성 ID
  step            TEXT,                                     -- 단계명
  step_index      INT,                                      -- 단계 순번
  template_id     BIGINT REFERENCES archive.prompt_templates(id),  -- 템플릿 ID
  rendered_prompt TEXT NOT NULL,                            -- 렌더된 프롬프트
  rendered_system TEXT,                                     -- 렌더된 시스템 프롬프트
  raw_response    TEXT);                                    -- 원시 응답

CREATE TABLE archive.generation_source_documents (         -- 생성 출처 문서
  id            BIGSERIAL PRIMARY KEY,                      -- 행 ID
  generation_id UUID NOT NULL REFERENCES archive.generations(id) ON DELETE CASCADE,  -- 생성 ID
  document_id   UUID REFERENCES archive.documents(id) ON DELETE SET NULL,  -- 출처 문서 ID(삭제 시 NULL)
  role          TEXT,                                       -- 출처 역할
  cited_title   TEXT,                                       -- 인용 시점 문서 제목 스냅샷
  UNIQUE (generation_id, document_id));

CREATE TABLE archive.generation_source_chunks (            -- 생성 출처 청크
  id             BIGSERIAL PRIMARY KEY,                     -- 행 ID
  generation_id  UUID NOT NULL REFERENCES archive.generations(id) ON DELETE CASCADE,  -- 생성 ID
  chunk_id       UUID REFERENCES archive.document_chunks(id) ON DELETE SET NULL,  -- 출처 청크 ID(삭제 시 NULL)
  document_id    UUID REFERENCES archive.documents(id) ON DELETE SET NULL,  -- 출처 문서 ID(삭제 시 NULL)
  citation_index INT,                                       -- 인용 번호
  retrieval_rank INT,                                       -- 검색 순위
  similarity     REAL,                                      -- 유사도
  used_in_step   TEXT,                                      -- 사용 단계
  cited_text     TEXT,                                      -- 인용 청크 본문 스냅샷
  cited_title    TEXT);                                     -- 인용 시점 문서 제목 스냅샷

CREATE TABLE archive.generation_charts (                   -- 생성 차트
  id              BIGSERIAL PRIMARY KEY,                    -- 차트 ID
  generation_id   UUID REFERENCES archive.generations(id) ON DELETE CASCADE,  -- 생성 ID
  title           TEXT,                                     -- 차트 제목
  spec_format     TEXT DEFAULT 'vega-lite',                 -- 스펙 포맷
  spec            JSONB NOT NULL,                           -- 차트 스펙
  data_rows       JSONB,                                    -- 데이터 행
  computed_stats  JSONB,                                    -- 계산 통계
  valid           BOOLEAN,                                  -- 유효 여부
  repair_attempts INT DEFAULT 0);                           -- 수리 시도 횟수
```

## 2. 무결성·삭제 정책
- 생성 삭제 → 하위 계보 연쇄 삭제
  - `generations` 한 행을 삭제하면, 그 생성을 가리키는(`generation_id` FK) 모든 하위 행 — `generation_prompts`·`generation_source_documents`·`generation_source_chunks`·`generation_charts` — 이 `ON DELETE CASCADE`로 자동 삭제된다.
  - 즉 생성 1회 기록을 지우면 그 프롬프트·출처·차트 계보가 통째로 사라진다.
- 산출물 문서 삭제 → 헤드는 유지, 링크만 끊김
  - 산출물로 materialize된 `documents` 행이 삭제되면, 이를 가리키던 `generations.output_document_id`가 `ON DELETE SET NULL`로 NULL이 된다.
  - 그 의미(산출물 내역에서 비노출, 계보 헤드 행 유지)는 ai-outputs.md §9.
- 출처(source) 문서·청크 삭제 → 인용 행 보존, 링크만 끊김
  - 출처 FK(`generation_source_documents.document_id`, `generation_source_chunks.chunk_id`·`document_id`)는 `ON DELETE SET NULL`.
  - 원본 `documents`·`document_chunks`를 삭제하면 인용 행의 해당 FK만 NULL이 되고, 인용 행과 스냅샷(`cited_text`·`cited_title`)은 남는다.
  - 따라서 원본 삭제는 차단되지 않으며(보관함에서 삭제 가능), 계보·근거는 스냅샷으로 유지된다.

## 3. 운영 배포 전 TODO
- 출처 문서 삭제 시 계보 정책
  - 해결: [x]
  - 비고: 설계 반영 완료 — 출처 FK를 `ON DELETE SET NULL`(+nullable)로, 인용 스냅샷(`cited_text`·`cited_title`) 컬럼 추가를 §1 DDL·§2 정책에 적용. 생성 시 `document_chunks.content`를 스냅샷에 복사해 원본 삭제 후에도 계보·근거 유지.
