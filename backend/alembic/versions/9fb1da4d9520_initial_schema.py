"""initial schema

전 스키마를 수기로 정의한다(B3). 확장·ENUM·HNSW/PGroonga/gin 인덱스는 autogenerate가
처리 못 하므로 직접 작성한다(data-overview §4). 확장은 02-infra에서 선설치되었으므로
`IF NOT EXISTS`로 가드만 한다(중복·권한 충돌 방지).

DDL 출처: users-schema §1, folders-schema §1, documents-schema §1, generations-schema §1.

Revision ID: 9fb1da4d9520
Revises:
Create Date: 2026-06-18
"""

from collections.abc import Sequence

from alembic import op

revision: str = "9fb1da4d9520"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # --- 스키마·확장 가드 (02-infra 선설치, infrastructure §3 / data-overview §3) ---
    op.execute("CREATE SCHEMA IF NOT EXISTS archive")
    op.execute("CREATE SCHEMA IF NOT EXISTS archive_ext")
    op.execute("CREATE EXTENSION IF NOT EXISTS vector SCHEMA archive_ext")
    op.execute("CREATE EXTENSION IF NOT EXISTS pgroonga SCHEMA archive_ext")

    # --- ENUM 타입 (5종) ---
    op.execute("CREATE TYPE archive.doc_status AS ENUM ('uploaded','processing','ready','failed')")
    op.execute(
        "CREATE TYPE archive.doc_stage AS ENUM "
        "('extracting','generating_meta','chunking','embedding')"
    )
    op.execute("CREATE TYPE archive.artifact_kind AS ENUM ('summary','draft','report')")
    op.execute(
        "CREATE TYPE archive.gen_method AS ENUM "
        "('stuff','map_reduce','hierarchical','outline_expand','report_pipeline')"
    )
    op.execute("CREATE TYPE archive.job_status AS ENUM ('queued','running','succeeded','failed')")

    # --- users (users-schema §1) ---
    op.execute(
        """
        CREATE TABLE archive.users (
          id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )

    # --- folders (folders-schema §1) ---
    op.execute(
        """
        CREATE TABLE archive.folders (
          id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          parent_id  UUID REFERENCES archive.folders(id) ON DELETE CASCADE,
          owner_id   UUID NOT NULL REFERENCES archive.users(id),
          name       TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT uq_folder_sibling_name UNIQUE (parent_id, owner_id, name)
        )
        """
    )
    op.execute("CREATE INDEX ix_folders_parent_id ON archive.folders(parent_id)")

    # --- documents (documents-schema §1) ---
    op.execute(
        """
        CREATE TABLE archive.documents (
          id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          folder_id         UUID REFERENCES archive.folders(id) ON DELETE CASCADE,
          owner_id          UUID NOT NULL REFERENCES archive.users(id),
          object_key        TEXT NOT NULL UNIQUE,
          bucket            TEXT NOT NULL,
          original_filename TEXT NOT NULL,
          mime_type         TEXT,
          size_bytes        BIGINT,
          sha256            CHAR(64),
          status            archive.doc_status NOT NULL DEFAULT 'uploaded',
          stage             archive.doc_stage,
          error             TEXT,
          page_count        INT,
          author            TEXT,
          language          TEXT,
          doc_created_at    TIMESTAMPTZ,
          doc_modified_at   TIMESTAMPTZ,
          llm_title         TEXT,
          llm_summary       TEXT,
          topics            TEXT[],
          keywords          TEXT[],
          ingest_ms         INT,
          created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX ix_documents_folder_id ON archive.documents(folder_id)")
    op.execute("CREATE INDEX ix_documents_sha256 ON archive.documents(sha256)")

    # --- document_chunks (documents-schema §1) ---
    op.execute(
        """
        CREATE TABLE archive.document_chunks (
          id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          document_id   UUID NOT NULL REFERENCES archive.documents(id) ON DELETE CASCADE,
          parent_doc_id UUID,
          chunk_index   INT NOT NULL,
          content       TEXT NOT NULL,
          metadata      JSONB,
          embedding     vector(1024) NOT NULL,
          CONSTRAINT uq_chunk_document_index UNIQUE (document_id, chunk_index)
        )
        """
    )
    # 특수 인덱스 (documents-schema §1): HNSW cosine · PGroonga 한국어 · gin metadata
    op.execute(
        "CREATE INDEX ix_chunks_hnsw ON archive.document_chunks "
        "USING hnsw (embedding vector_cosine_ops) WITH (m=16, ef_construction=200)"
    )
    op.execute(
        "CREATE INDEX ix_chunks_content_pgroonga ON archive.document_chunks "
        "USING pgroonga (content)"
    )
    op.execute("CREATE INDEX ix_chunks_metadata ON archive.document_chunks USING gin (metadata)")

    # --- models (정적 레지스트리, generations-schema §1) ---
    op.execute(
        """
        CREATE TABLE archive.models (
          id             BIGSERIAL PRIMARY KEY,
          name           TEXT NOT NULL,
          file_path      TEXT,
          file_sha256    TEXT,
          quantization   TEXT,
          context_window INT,
          provider       TEXT NOT NULL DEFAULT 'llama.cpp',
          runtime_build  TEXT,
          created_at     TIMESTAMPTZ DEFAULT now()
        )
        """
    )

    # --- generations (계보 헤드, generations-schema §1) ---
    op.execute(
        """
        CREATE TABLE archive.generations (
          id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          kind               archive.artifact_kind NOT NULL,
          method             archive.gen_method,
          status             archive.job_status NOT NULL DEFAULT 'queued',
          user_id            UUID REFERENCES archive.users(id),
          model_id           BIGINT REFERENCES archive.models(id),
          provider           TEXT,
          temperature        REAL,
          top_p              REAL,
          top_k              INT,
          seed               BIGINT,
          max_tokens         INT,
          decode_params      JSONB,
          embedding_model    TEXT,
          retrieval_k        INT,
          retrieval_params   JSONB,
          prompt_tokens      INT,
          completion_tokens  INT,
          total_tokens       INT,
          latency_ms         INT,
          output_text        TEXT,
          output_meta        JSONB,
          error              TEXT,
          output_document_id UUID REFERENCES archive.documents(id) ON DELETE SET NULL,
          progress_pct       INT DEFAULT 0,
          progress_step      TEXT,
          created_at         TIMESTAMPTZ DEFAULT now(),
          started_at         TIMESTAMPTZ,
          finished_at        TIMESTAMPTZ
        )
        """
    )

    op.execute(
        """
        CREATE TABLE archive.generation_prompts (
          id              BIGSERIAL PRIMARY KEY,
          generation_id   UUID REFERENCES archive.generations(id) ON DELETE CASCADE,
          step            TEXT,
          step_index      INT,
          rendered_prompt TEXT NOT NULL,
          rendered_system TEXT,
          raw_response    TEXT
        )
        """
    )

    op.execute(
        """
        CREATE TABLE archive.generation_source_documents (
          id            BIGSERIAL PRIMARY KEY,
          generation_id UUID NOT NULL REFERENCES archive.generations(id) ON DELETE CASCADE,
          document_id   UUID REFERENCES archive.documents(id) ON DELETE SET NULL,
          role          TEXT,
          cited_title   TEXT,
          CONSTRAINT uq_gen_source_doc UNIQUE (generation_id, document_id)
        )
        """
    )

    op.execute(
        """
        CREATE TABLE archive.generation_source_chunks (
          id             BIGSERIAL PRIMARY KEY,
          generation_id  UUID NOT NULL REFERENCES archive.generations(id) ON DELETE CASCADE,
          chunk_id       UUID REFERENCES archive.document_chunks(id) ON DELETE SET NULL,
          document_id    UUID REFERENCES archive.documents(id) ON DELETE SET NULL,
          citation_index INT,
          retrieval_rank INT,
          similarity     REAL,
          used_in_step   TEXT,
          cited_text     TEXT,
          cited_title    TEXT
        )
        """
    )

    op.execute(
        """
        CREATE TABLE archive.generation_charts (
          id              BIGSERIAL PRIMARY KEY,
          generation_id   UUID REFERENCES archive.generations(id) ON DELETE CASCADE,
          title           TEXT,
          spec_format     TEXT DEFAULT 'vega-lite',
          spec            JSONB NOT NULL,
          data_rows       JSONB,
          computed_stats  JSONB,
          valid           BOOLEAN,
          repair_attempts INT DEFAULT 0
        )
        """
    )


def downgrade() -> None:
    # 테이블 → 타입 순으로 제거. 공유 확장·스키마(archive/archive_ext)는 두지 않는다.
    for table in (
        "generation_charts",
        "generation_source_chunks",
        "generation_source_documents",
        "generation_prompts",
        "generations",
        "models",
        "document_chunks",
        "documents",
        "folders",
        "users",
    ):
        op.execute(f"DROP TABLE IF EXISTS archive.{table} CASCADE")
    for enum in ("job_status", "gen_method", "artifact_kind", "doc_stage", "doc_status"):
        op.execute(f"DROP TYPE IF EXISTS archive.{enum}")
