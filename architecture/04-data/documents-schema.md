---
created: 2026-06-12
updated: 2026-06-12
status: approved
overview: 문서·청크 테이블 스키마(인덱스 포함)와 삭제 정책을 정의한다.
refs: research/01-mvp-research/01 §5.4, research/01-mvp-research/04 §4b
---

# 문서·청크 스키마

## 1. 테이블 DDL (스키마=archive)

### documents
```sql
CREATE TYPE archive.doc_status AS ENUM ('uploaded','processing','ready','failed');  -- 문서 처리 상태
CREATE TYPE archive.doc_stage AS ENUM ('extracting','generating_meta','chunking','embedding');  -- 인제스트 단계

CREATE TABLE archive.documents (                                        -- 문서
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),         -- 문서 ID
  folder_id         UUID REFERENCES archive.folders(id) ON DELETE CASCADE,  -- 소속 폴더 ID
  owner_id          UUID NOT NULL REFERENCES archive.users(id),         -- 소유자 ID
  object_key        TEXT NOT NULL UNIQUE,                               -- 오브젝트 키
  bucket            TEXT NOT NULL,                                      -- 버킷명
  original_filename TEXT NOT NULL,                                      -- 원본 파일명
  mime_type         TEXT,                                               -- MIME 타입
  size_bytes        BIGINT,                                             -- 파일 크기(바이트)
  sha256            CHAR(64),                                           -- 본문 SHA-256 해시
  status            archive.doc_status NOT NULL DEFAULT 'uploaded',     -- 처리 상태
  stage             archive.doc_stage,                                  -- 인제스트 단계
  error             TEXT,                                               -- 오류 메시지
  page_count        INT,                                                -- 쪽수
  author            TEXT,                                               -- 작성자
  language          TEXT,                                               -- 언어
  doc_created_at    TIMESTAMPTZ,                                        -- 원본 생성일
  doc_modified_at   TIMESTAMPTZ,                                        -- 원본 수정일
  llm_title         TEXT,                                               -- AI 추출 제목(읽기 전용)
  llm_summary       TEXT,                                               -- AI 추출 요약(읽기 전용)
  keywords          TEXT[],                                             -- AI 추출 키워드(읽기 전용)
  ingest_ms         INT,                                                -- 인제스트 소요(ms)
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),                 -- 등록 일시(화면 노출)
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()                  -- 수정 일시(내부 감사용)
);
CREATE INDEX ix_documents_folder_id ON archive.documents(folder_id);
CREATE INDEX ix_documents_sha256 ON archive.documents(sha256);
```

### document_chunks (벡터, 스키마=archive)
- `embedding`(의미 검색)은 `archive_ext` 스키마 `vector` 확장의 HNSW, `content`(키워드 검색)는 PGroonga 인덱스를 쓴다(확장 의존은 data-overview §3).
```sql
CREATE TABLE archive.document_chunks (                                  -- 문서 청크
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),             -- 청크 ID
  document_id   UUID NOT NULL REFERENCES archive.documents(id) ON DELETE CASCADE,  -- 문서 ID
  parent_doc_id UUID,                                                   -- 상위 문서 ID(부모 청킹)
  chunk_index   INT NOT NULL,                                           -- 청크 순번
  content       TEXT NOT NULL,                                          -- 청크 본문
  metadata      JSONB,                                                  -- 청크 메타데이터
  embedding     vector(1024) NOT NULL,                                  -- 임베딩 벡터(1024d)
  UNIQUE (document_id, chunk_index)
);
CREATE INDEX ix_chunks_hnsw ON archive.document_chunks
  USING hnsw (embedding vector_cosine_ops) WITH (m=16, ef_construction=200);
CREATE INDEX ix_chunks_content_pgroonga ON archive.document_chunks USING pgroonga (content);
CREATE INDEX ix_chunks_metadata ON archive.document_chunks USING gin (metadata);
```
- 인제스트 청크 적재는 멱등 upsert: `INSERT ... ON CONFLICT (document_id, chunk_index) DO UPDATE`로 재실행 시 중복 없이 갱신한다.

## 2. 무결성·삭제 정책
- 문서 삭제 → 청크 연쇄 삭제
  - `documents` 한 행을 삭제하면, 그 문서를 참조하는(`document_chunks.document_id` FK) 모든 `document_chunks` 행이 `ON DELETE CASCADE`로 자동 삭제된다.
  - 즉 문서 1개를 지우면 그 문서에서 쪼갠 청크 N개가 DB에서 함께 사라진다
- MinIO 오브젝트는 CASCADE 대상 아님(앱이 별도 삭제).
- 생성 출처로 인용된 문서·청크의 삭제 차단은 `generations-schema.md` §2 참조.

## 3. 무결성·중복 (`sha256`)
- `sha256` 컬럼: 파일 본문 해시(무결성 검증·동일 파일 식별).
- `ix_documents_sha256` 인덱스로 동일 파일 조회를 가속한다.
- 중복 처리 규칙은 document.md §4.
