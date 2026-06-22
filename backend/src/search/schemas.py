"""검색·RAG API 스키마 (search-backend §1)."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

SearchMode = Literal["keyword", "semantic"]


class SearchFilters(BaseModel):
    folder_id: UUID | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None


class SearchRequest(BaseModel):
    q: str = Field(min_length=1)
    mode: SearchMode = "semantic"
    filters: SearchFilters = Field(default_factory=SearchFilters)
    limit: int = 20


class SearchResultItem(BaseModel):
    document_id: UUID
    chunk_id: UUID
    score: float  # 키워드=pgroonga_score, 의미=유사도(1-distance)
    content: str
    original_filename: str
    llm_title: str | None
    keywords: list[str]
    folder_id: UUID | None
    created_at: datetime


class SearchResponse(BaseModel):
    results: list[SearchResultItem]
    elapsed_ms: int


class Citation(BaseModel):
    n: int
    chunk_id: UUID
    document_id: UUID


class AskRequest(BaseModel):
    q: str = Field(min_length=1)
    filters: SearchFilters = Field(default_factory=SearchFilters)
    k: int = 8


class AskResponse(BaseModel):
    answer: str
    citations: list[Citation]
    elapsed_ms: int


class QueryParse(BaseModel):
    """자연어 질의 구조화 추출 결과 (search-and-rag §3)."""

    rewritten_query: str = Field(description="검색에 적합하게 재작성한 질의")
    keywords: list[str] = Field(description="핵심 키워드")
    time_ref: str | None = Field(default=None, description="기간 표현(예: 작년, 지난달). 없으면 null")
    folder: str | None = Field(default=None, description="폴더명 힌트. 없으면 null")
