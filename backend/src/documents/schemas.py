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


class DocumentUpdate(BaseModel):
    # 부분 갱신 — 보낸 필드만 반영(model_fields_set). folder_id=null 은 루트 이동(의미 있는 값).
    model_config = ConfigDict(extra="forbid")
    folder_id: UUID | None = None
    display_filename: str | None = Field(default=None, min_length=1)  # 현재 파일명 변경


class DownloadResponse(BaseModel):
    url: str  # presigned GET


class DocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    folder_id: UUID | None
    original_filename: str
    display_filename: str
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
    keywords: list[str] | None
    ingest_ms: int | None
    created_at: datetime
    updated_at: datetime
