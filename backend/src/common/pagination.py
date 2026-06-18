"""페이지네이션 유틸 (backend.md §7).

문서 목록은 keyset(cursor) 페이지네이션을 쓴다(document-backend §1: `limit`/`cursor`).
cursor는 `(created_at, id)` 정렬 기준의 마지막 행을 base64로 인코딩한 불투명 토큰이다.
"""

import base64
import json
from datetime import datetime
from typing import Generic, TypeVar
from uuid import UUID

from pydantic import BaseModel

T = TypeVar("T")

DEFAULT_LIMIT = 50
MAX_LIMIT = 200


class Page(BaseModel, Generic[T]):
    items: list[T]
    next_cursor: str | None = None


def encode_cursor(created_at: datetime, row_id: UUID) -> str:
    raw = json.dumps({"ts": created_at.isoformat(), "id": str(row_id)})
    return base64.urlsafe_b64encode(raw.encode()).decode()


def decode_cursor(cursor: str) -> tuple[datetime, UUID]:
    raw = json.loads(base64.urlsafe_b64decode(cursor.encode()).decode())
    return datetime.fromisoformat(raw["ts"]), UUID(raw["id"])


def clamp_limit(limit: int | None) -> int:
    if limit is None:
        return DEFAULT_LIMIT
    return max(1, min(limit, MAX_LIMIT))
