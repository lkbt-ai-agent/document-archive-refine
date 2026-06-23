"""문서·청크 모델 (documents-schema §1).

`documents`는 원본 추출 정보 + AI 생성 메타(읽기 전용)를 함께 보유한다.
`document_chunks`는 의미 검색용 1024d 벡터와 키워드 검색용 본문을 담는다.
HNSW·PGroonga·gin 인덱스는 수동 마이그레이션(B3)에서 생성한다.
"""

import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    TIMESTAMP,
    BigInteger,
    CHAR,
    ForeignKey,
    Integer,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from src.documents.enums import doc_stage_type, doc_status_type
from src.models import Base

EMBEDDING_DIM = 1024  # 전 시스템 고정 (data-overview §1, ingestion.md §5)


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    folder_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("folders.id", ondelete="CASCADE"),
        nullable=True,
        index=True,  # ix_documents_folder_id
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    # 오브젝트 저장 (documents-minio §1)
    object_key: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    bucket: Mapped[str] = mapped_column(Text, nullable=False)
    original_filename: Mapped[str] = mapped_column(Text, nullable=False)  # 업로드 당시 원본명(불변)
    display_filename: Mapped[str] = mapped_column(Text, nullable=False)  # 현재 파일명(최초=원본명, 변경 가능)
    mime_type: Mapped[str | None] = mapped_column(Text)
    size_bytes: Mapped[int | None] = mapped_column(BigInteger)
    sha256: Mapped[str | None] = mapped_column(CHAR(64), index=True)  # ix_documents_sha256

    # 처리 상태 (document.md §4)
    status: Mapped[str] = mapped_column(
        doc_status_type, nullable=False, server_default=text("'uploaded'")
    )
    stage: Mapped[str | None] = mapped_column(doc_stage_type)
    error: Mapped[str | None] = mapped_column(Text)
    retry_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )  # 재시도 횟수(상한 가드용)

    # 원본 속성
    page_count: Mapped[int | None] = mapped_column(Integer)
    author: Mapped[str | None] = mapped_column(Text)
    language: Mapped[str | None] = mapped_column(Text)
    doc_created_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))
    doc_modified_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))

    # AI 추출 메타 (읽기 전용, ingestion.md §3-3)
    llm_title: Mapped[str | None] = mapped_column(Text)
    llm_summary: Mapped[str | None] = mapped_column(Text)
    keywords: Mapped[list[str] | None] = mapped_column(ARRAY(Text))

    ingest_ms: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("now()")
    )


class DocumentChunk(Base):
    __tablename__ = "document_chunks"
    __table_args__ = (
        UniqueConstraint("document_id", "chunk_index", name="uq_chunk_document_index"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
    )
    parent_doc_id: Mapped[uuid.UUID | None] = mapped_column(PgUUID(as_uuid=True))
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    chunk_metadata: Mapped[dict | None] = mapped_column("metadata", JSONB)
    embedding: Mapped[list[float]] = mapped_column(Vector(EMBEDDING_DIM), nullable=False)
