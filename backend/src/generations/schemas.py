"""AI 산출물·계보 API 스키마 (ai-outputs-backend §1)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from src.generations.enums import ArtifactKind, GenMethod, JobStatus


class GenerationOptions(BaseModel):
    temperature: float | None = None
    seed: int | None = None
    max_tokens: int | None = None
    k: int | None = None  # 검색 후보 수


class GenerationCreate(BaseModel):
    kind: ArtifactKind
    document_ids: list[UUID] = Field(min_length=1)
    options: GenerationOptions = Field(default_factory=GenerationOptions)


class GenerationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    kind: ArtifactKind
    method: GenMethod | None
    status: JobStatus
    progress_pct: int | None
    progress_step: str | None
    provider: str | None
    model_id: int | None
    seed: int | None
    total_tokens: int | None
    latency_ms: int | None
    output_text: str | None
    output_document_id: UUID | None
    error: str | None
    created_at: datetime | None
    started_at: datetime | None
    finished_at: datetime | None


class SourceDocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    document_id: UUID | None
    role: str | None
    cited_title: str | None


class SourceChunkRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    chunk_id: UUID | None
    document_id: UUID | None
    citation_index: int | None
    similarity: float | None
    used_in_step: str | None
    cited_text: str | None
    cited_title: str | None


class PromptRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    step: str | None
    step_index: int | None
    rendered_system: str | None
    rendered_prompt: str
    raw_response: str | None


class ChartRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    title: str | None
    spec_format: str | None
    spec: dict
    data_rows: dict | list | None
    computed_stats: dict | None
    valid: bool | None
    repair_attempts: int | None


class LineageResponse(BaseModel):
    generation: GenerationRead
    source_documents: list[SourceDocumentRead]
    source_chunks: list[SourceChunkRead]
    prompts: list[PromptRead]
    charts: list[ChartRead]


class ArtifactListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    kind: ArtifactKind
    output_document_id: UUID | None
    created_at: datetime | None
