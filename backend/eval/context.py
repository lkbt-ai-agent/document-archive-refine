"""평가의 in-process 앱 재사용 (research 03-search-eval-testset/01 §5.1).

평가는 HTTP를 거치지 않고 앱의 세션·SearchService·EmbeddingClient를 같은 프로세스에서
직접 쓴다. 소유자는 앱의 단일 시드 사용자(SEED_USER_ID)이자 평가 owner다(01 §3.1).
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from uuid import UUID

import src.db_models  # noqa: F401  # 평가 프로세스에서도 전 모델 등록(FK 해소)
from sqlalchemy.ext.asyncio import AsyncSession

from src.ai.provider import EmbeddingClient, get_embedding_client
from src.database import async_session
from src.search.service import SearchService
from src.users.constants import SEED_USER_ID

# 평가 코퍼스가 쌓이는 owner. 앱의 단일 시드 사용자를 그대로 쓴다.
EVAL_OWNER_ID: UUID = SEED_USER_ID


@asynccontextmanager
async def eval_session() -> AsyncIterator[AsyncSession]:
    """평가용 DB 세션 하나를 연다."""
    async with async_session() as session:
        yield session


def build_search_service(
    session: AsyncSession,
    *,
    query_rewrite: bool = True,
    title_match: bool = True,
    rag_temperature: float = 0.0,
    rag_seed: int | None = 0,
) -> SearchService:
    """앱의 SearchService를 재사용하되 평가용 옵션을 주입한다(01 §5.3·§5.4).

    평가 기본값은 결정적 실행을 위해 rag 온도 0·고정 시드다. ablation은 query_rewrite·
    title_match 토글로 조건을 바꾼다.
    """
    return SearchService(
        session,
        query_rewrite=query_rewrite,
        title_match=title_match,
        rag_temperature=rag_temperature,
        rag_seed=rag_seed,
    )


def embedding_client() -> EmbeddingClient:
    """앱의 임베딩 클라이언트를 그대로 재사용한다."""
    return get_embedding_client()
