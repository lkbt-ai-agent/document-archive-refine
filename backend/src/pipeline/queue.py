"""arq enqueue 인터페이스 (backend.md §10, infrastructure §5).

service가 비동기 작업(인제스트·생성)을 Redis 큐에 넣을 때 쓰는 단일 진입점.
"""

from arq import create_pool
from arq.connections import RedisSettings
from arq.constants import abort_jobs_ss
from arq.utils import timestamp_ms

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


async def abort_job(job_id: str) -> None:
    """실행/대기 중 job에 중단 신호(best-effort·비블로킹). 워커는 `allow_abort_jobs`로 처리한다.
    `arq:abort` set에 추가하면 실행 중 job은 취소되고, 대기 중 job은 픽업 시 시작 전 취소된다.
    문서 삭제 시 진행 중 인제스트를 선제 중단해 낭비 작업을 줄인다(04-frontend D13)."""
    pool = await create_pool(redis_settings())
    try:
        await pool.zadd(abort_jobs_ss, {job_id: timestamp_ms()})
    finally:
        await pool.aclose()
