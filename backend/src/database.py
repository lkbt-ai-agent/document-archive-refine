"""비동기 DB 엔진·세션 (backend.md §5, infrastructure §3).

`.env`의 `postgresql+psycopg` 연결 문자열로 async 엔진을 만들고 세션 팩토리를 구성한다.
`expire_on_commit=False`로 커밋 후에도 ORM 속성을 재조회 없이 사용한다(async 지연로딩 재조회 방지).
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.config import settings

# search_path는 02-infra에서 `ALTER ROLE ... SET search_path`로도 적용되지만,
# 연결마다 명시해 환경 의존을 줄인다(infrastructure §3).
engine = create_async_engine(
    settings.database_url,
    echo=settings.db_echo,
    pool_pre_ping=True,
    connect_args={"options": f"-csearch_path={settings.search_path}"},
)

async_session = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI 의존성: 요청 단위 세션. 트랜잭션 경계는 service에서 관리한다."""
    async with async_session() as session:
        yield session
