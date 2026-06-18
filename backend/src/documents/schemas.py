"""문서 API 스키마 (document-backend §1·§2)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from src.documents.enums import DocStage, DocStatus


class UploadInitRequest(BaseModel):
    folder_id: UUID | None = None
    original_filename: str = Field(min_length=1)
    mime_type: str | None = None
    size_bytes: int | None = None


class UploadInitResponse(BaseModel):
    document_id: UUID
    object_key: str
    bucket: str
    upload_url: str  # presigned PUT


class DocumentMove(BaseModel):
    model_config = ConfigDict(extra="forbid")
    folder_id: UUID | None = None


class DownloadResponse(BaseModel):
    url: str  # presigned GET


class DocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    folder_id: UUID | None
    original_filename: str
    mime_type: str | None
    size_bytes: int | None
    sha256: str | None
    status: DocStatus
    stage: DocStage | None
    error: str | None
    page_count: int | None
    author: str | None
    language: str | None
    doc_created_at: datetime | None
    doc_modified_at: datetime | None
    llm_title: str | None
    llm_summary: str | None
    topics: list[str] | None
    keywords: list[str] | None
    ingest_ms: int | None
    created_at: datetime
    updated_at: datetime
