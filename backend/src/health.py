"""헬스체크 (backend.md §11).

원격 PG/MinIO/Redis/llama 연결을 점검한다. 기동 시 PG/MinIO 도달 실패는 fail-fast(핵심 의존),
Redis/llama 실패는 경고만(개발 중 꺼져 있을 수 있음 — scripts/healthcheck.sh와 동일 정책).
"""

import asyncio
import logging

import httpx
from sqlalchemy import text

from src.config import settings
from src.database import engine
from src.storage.minio_client import get_minio

logger = logging.getLogger("mechive.health")


async def check_postgres() -> bool:
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    return True


async def check_minio() -> bool:
    # minio SDK는 동기라 스레드로 오프로드한다.
    return await asyncio.to_thread(get_minio().bucket_exists, settings.minio_bucket)


async def check_redis() -> bool:
    from redis.asyncio import from_url

    client = from_url(settings.redis_url)
    try:
        return bool(await client.ping())
    finally:
        await client.aclose()


async def check_llama(url: str) -> bool:
    async with httpx.AsyncClient(timeout=5.0) as client:
        resp = await client.get(f"{url.rstrip('/')}/health")
        return resp.status_code == 200


async def assert_core_dependencies() -> None:
    """기동 시 호출. PG/MinIO 도달 실패 시 예외로 fail-fast한다."""
    try:
        await check_postgres()
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(f"PostgreSQL 도달 실패 (fail-fast): {exc}") from exc

    try:
        ok = await check_minio()
        if not ok:
            raise RuntimeError(f"MinIO 버킷 없음: {settings.minio_bucket}")
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(f"MinIO 도달 실패 (fail-fast): {exc}") from exc

    # 비핵심 의존: 경고만
    for name, coro in (
        ("redis", check_redis()),
        ("llama-chat", check_llama(settings.llama_chat_url)),
        ("llama-embed", check_llama(settings.llama_embed_url)),
    ):
        try:
            await coro
        except Exception as exc:  # noqa: BLE001
            logger.warning("비핵심 의존 %s 점검 실패(계속 진행): %s", name, exc)


async def health_report() -> dict[str, bool]:
    """`GET /health` 응답용 상세 점검. 예외는 False로 환산한다."""
    async def _safe(coro) -> bool:
        try:
            return bool(await coro)
        except Exception:  # noqa: BLE001
            return False

    pg, minio_ok, redis_ok, chat, embed = await asyncio.gather(
        _safe(check_postgres()),
        _safe(check_minio()),
        _safe(check_redis()),
        _safe(check_llama(settings.llama_chat_url)),
        _safe(check_llama(settings.llama_embed_url)),
    )
    return {
        "postgres": pg,
        "minio": minio_ok,
        "redis": redis_ok,
        "llama_chat": chat,
        "llama_embed": embed,
    }
