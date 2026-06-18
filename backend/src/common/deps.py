"""공통 FastAPI 의존성 (backend.md §7).

owner 스코프 강제: 모든 조회/변경은 `owner_id`로 격리한다. MVP는 인증이 없어 고정 시드
사용자를 owner로 쓴다(users-schema §2). 인증 도입 시 이 의존성만 교체하면 된다.
"""

from typing import Annotated
from uuid import UUID

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_session
from src.users.constants import SEED_USER_ID


async def get_owner_id() -> UUID:
    """현재 요청의 owner_id. MVP는 시드 사용자 고정."""
    return SEED_USER_ID


SessionDep = Annotated[AsyncSession, Depends(get_session)]
OwnerDep = Annotated[UUID, Depends(get_owner_id)]
