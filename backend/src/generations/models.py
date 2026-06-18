"""생성 계보 모델 (generations-schema §1).

`generations`가 계보 헤드(생성 1회)이고, 하위 테이블(프롬프트·출처문서·출처청크·차트)이
연결된다. `models`/`prompt_templates`는 정적 레지스트리. 출처 FK는 원본 삭제에도 계보가
남도록 `ON DELETE SET NULL` + 스냅샷 컬럼(`cited_text`/`cited_title`)을 둔다(generations-schema §2).
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    TIMESTAMP,
    BigInteger,
    Boolean,
    ForeignKey,
    REAL,
    Integer,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from src.generations.enums import artifact_kind_type, gen_method_type, job_status_type
from src.models import Base


class Model(Base):
    """모델 레지스트리(정적). B4에서 A.X 4.0 Light / KURE-v1 시드 (models.md)."""

    __tablename__ = "models"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    file_path: Mapped[str | None] = mapped_column(Text)
    file_sha256: Mapped[str | None] = mapped_column(Text)
    quantization: Mapped[str | None] = mapped_column(Text)
    context_window: Mapped[int | None] = mapped_column(Integer)
    provider: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'llama.cpp'"))
    runtime_build: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), server_default=text("now()")
    )


class PromptTemplate(Base):
    __tablename__ = "prompt_templates"
    __table_args__ = (UniqueConstraint("key", "version", name="uq_prompt_template_key_version"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(Text, nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    language: Mapped[str | None] = mapped_column(Text, server_default=text("'ko'"))
    body: Mapped[str] = mapped_column(Text, nullable=False)


class Generation(Base):
    """계보 헤드 = 생성 1회."""

    __tablename__ = "generations"

    id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    kind: Mapped[str] = mapped_column(artifact_kind_type, nullable=False)
    method: Mapped[str | None] = mapped_column(gen_method_type)
    status: Mapped[str] = mapped_column(
        job_status_type, nullable=False, server_default=text("'queued'")
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id")
    )
    model_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("models.id"))
    provider: Mapped[str | None] = mapped_column(Text)

    # 디코딩 파라미터 (재현성, ai-outputs.md §7)
    temperature: Mapped[float | None] = mapped_column(REAL)
    top_p: Mapped[float | None] = mapped_column(REAL)
    top_k: Mapped[int | None] = mapped_column(Integer)
    seed: Mapped[int | None] = mapped_column(BigInteger)
    max_tokens: Mapped[int | None] = mapped_column(Integer)
    decode_params: Mapped[dict | None] = mapped_column(JSONB)

    # 검색 파라미터
    embedding_model: Mapped[str | None] = mapped_column(Text)
    retrieval_k: Mapped[int | None] = mapped_column(Integer)
    retrieval_params: Mapped[dict | None] = mapped_column(JSONB)

    # 토큰·지연
    prompt_tokens: Mapped[int | None] = mapped_column(Integer)
    completion_tokens: Mapped[int | None] = mapped_column(Integer)
    total_tokens: Mapped[int | None] = mapped_column(Integer)
    latency_ms: Mapped[int | None] = mapped_column(Integer)

    # 산출물
    output_text: Mapped[str | None] = mapped_column(Text)
    output_meta: Mapped[dict | None] = mapped_column(JSONB)
    error: Mapped[str | None] = mapped_column(Text)
    output_document_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("documents.id", ondelete="SET NULL")
    )

    progress_pct: Mapped[int | None] = mapped_column(Integer, server_default=text("0"))
    progress_step: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), server_default=text("now()")
    )
    started_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))


class GenerationPrompt(Base):
    __tablename__ = "generation_prompts"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    generation_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("generations.id", ondelete="CASCADE")
    )
    step: Mapped[str | None] = mapped_column(Text)
    step_index: Mapped[int | None] = mapped_column(Integer)
    template_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("prompt_templates.id"))
    rendered_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    rendered_system: Mapped[str | None] = mapped_column(Text)
    raw_response: Mapped[str | None] = mapped_column(Text)


class GenerationSourceDocument(Base):
    __tablename__ = "generation_source_documents"
    __table_args__ = (
        UniqueConstraint("generation_id", "document_id", name="uq_gen_source_doc"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    generation_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("generations.id", ondelete="CASCADE"), nullable=False
    )
    document_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("documents.id", ondelete="SET NULL")
    )
    role: Mapped[str | None] = mapped_column(Text)
    cited_title: Mapped[str | None] = mapped_column(Text)  # 인용 시점 제목 스냅샷


class GenerationSourceChunk(Base):
    __tablename__ = "generation_source_chunks"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    generation_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("generations.id", ondelete="CASCADE"), nullable=False
    )
    chunk_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("document_chunks.id", ondelete="SET NULL")
    )
    document_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("documents.id", ondelete="SET NULL")
    )
    citation_index: Mapped[int | None] = mapped_column(Integer)
    retrieval_rank: Mapped[int | None] = mapped_column(Integer)
    similarity: Mapped[float | None] = mapped_column(REAL)
    used_in_step: Mapped[str | None] = mapped_column(Text)
    cited_text: Mapped[str | None] = mapped_column(Text)  # 인용 청크 본문 스냅샷
    cited_title: Mapped[str | None] = mapped_column(Text)


class GenerationChart(Base):
    __tablename__ = "generation_charts"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    generation_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("generations.id", ondelete="CASCADE")
    )
    title: Mapped[str | None] = mapped_column(Text)
    spec_format: Mapped[str | None] = mapped_column(Text, server_default=text("'vega-lite'"))
    spec: Mapped[dict] = mapped_column(JSONB, nullable=False)
    data_rows: Mapped[dict | None] = mapped_column(JSONB)
    computed_stats: Mapped[dict | None] = mapped_column(JSONB)
    valid: Mapped[bool | None] = mapped_column(Boolean)
    repair_attempts: Mapped[int | None] = mapped_column(Integer, server_default=text("0"))
