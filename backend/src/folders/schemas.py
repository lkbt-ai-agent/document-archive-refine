"""폴더 API 스키마 (folders-backend §1)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class FolderCreate(BaseModel):
    parent_id: UUID | None = None
    name: str = Field(min_length=1, max_length=255)


class FolderUpdate(BaseModel):
    """이름변경(`name`) 또는 이동(`parent_id`). 둘 중 제공된 필드만 적용한다.

    `parent_id=None`은 '루트로 이동'을 뜻하므로, 미제공과 구분하기 위해 `model_fields_set`을
    service에서 검사한다.
    """

    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=255)
    parent_id: UUID | None = None


class FolderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    parent_id: UUID | None
    name: str
    created_at: datetime
    updated_at: datetime
