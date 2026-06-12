---
created: 2026-06-12
updated: 2026-06-12
status: approved
overview: 문서·청크 테이블 스키마(인덱스 포함)와 삭제 정책을 정의한다.
refs: research/01 §5.4, research/04 §4b
---

# 문서·청크 스키마

## 1. 테이블 DDL (스키마=archive)

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

### document_chunks (벡터, 스키마=archive)
- `embedding` 컬럼의 `vector` 타입과 HNSW 인덱스는 `public` 스키마의 `vector` 확장에 의존(schema-rule §3).
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
