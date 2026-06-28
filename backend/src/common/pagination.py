"""페이지네이션 유틸 (backend.md §7).

문서 목록은 keyset(cursor) 페이지네이션을 쓴다(document-backend §1: `limit`/`cursor`/`sort`).
cursor는 정렬 기준의 마지막 행을 base64로 인코딩한 불투명 토큰이다. 정렬을 4종(최신/오래된/
파일명 오름/내림)으로 바꿀 수 있으므로 cursor는 정렬 모드(`sort`)와 정렬 키 값(`v`, created_at의
ISO 문자열이거나 display_filename 문자열)과 id를 함께 담는다. 정렬 키 값을 문자열로 통일해
시간순과 파일명순을 한 토큰 형식으로 처리한다.
"""

import base64
import json
from typing import Generic, TypeVar
from uuid import UUID

from pydantic import BaseModel

T = TypeVar("T")

DEFAULT_LIMIT = 50
MAX_LIMIT = 200


class Page(BaseModel, Generic[T]):
    items: list[T]
    next_cursor: str | None = None


def encode_cursor(sort: str, value: str, row_id: UUID) -> str:
    raw = json.dumps({"sort": sort, "v": value, "id": str(row_id)})
    return base64.urlsafe_b64encode(raw.encode()).decode()


def decode_cursor(cursor: str) -> tuple[str, str, UUID]:
    raw = json.loads(base64.urlsafe_b64decode(cursor.encode()).decode())
    return raw["sort"], raw["v"], UUID(raw["id"])


def clamp_limit(limit: int | None) -> int:
    if limit is None:
        return DEFAULT_LIMIT
    return max(1, min(limit, MAX_LIMIT))
