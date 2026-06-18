"""arq enqueue 인터페이스 (backend.md §10, infrastructure §5).

service가 비동기 작업(인제스트·생성)을 Redis 큐에 넣을 때 쓰는 단일 진입점.
"""

from arq import create_pool
from arq.connections import RedisSettings

from src.config import settings


def redis_settings() -> RedisSettings:
    return RedisSettings.from_dsn(settings.redis_url)


async def enqueue(task: str, *args, **kwargs):
    """작업 이름으로 enqueue. 멱등 키는 호출부에서 `_job_id`로 지정한다(backend §10)."""
    pool = await create_pool(redis_settings())
    try:
        return await pool.enqueue_job(task, *args, **kwargs)
    finally:
        await pool.aclose()
