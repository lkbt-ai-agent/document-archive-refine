"""스토리지 서비스 (document-backend §2·§3).

MinIO presigned URL 발급과 오브젝트 삭제·검증을 담당한다. 폴더/문서 삭제가 공유하는
오브젝트 삭제 위임도 여기 둔다(folders-backend §2). minio SDK는 동기라 스레드로 오프로드한다.
"""

import asyncio
import io
from datetime import timedelta
from urllib.parse import quote

from minio.deleteobjects import DeleteObject

from src.config import settings
from src.storage.minio_client import get_minio


async def presign_put(object_key: str, ttl: int | None = None) -> str:
    """업로드용 presigned PUT (document-backend §3)."""
    expiry = timedelta(seconds=ttl or settings.presign_ttl_seconds)
    return await asyncio.to_thread(
        get_minio().presigned_put_object, settings.minio_bucket, object_key, expiry
    )


async def presign_get(object_key: str, filename: str | None = None, ttl: int | None = None) -> str:
    """다운로드용 presigned GET. 한국어 파일명은 RFC 5987로 Content-Disposition에 싣는다."""
    expiry = timedelta(seconds=ttl or settings.presign_ttl_seconds)
    extra: dict[str, str] = {}
    if filename:
        encoded = quote(filename)
        extra["response-content-disposition"] = f"attachment; filename*=UTF-8''{encoded}"
    return await asyncio.to_thread(
        get_minio().presigned_get_object,
        settings.minio_bucket,
        object_key,
        expiry,
        response_headers=extra or None,
    )


async def stat_object(object_key: str):
    """오브젝트 메타(존재·크기) 조회. 없으면 minio.error.S3Error(NoSuchKey)."""
    return await asyncio.to_thread(get_minio().stat_object, settings.minio_bucket, object_key)


async def object_exists(object_key: str) -> bool:
    from minio.error import S3Error

    try:
        await stat_object(object_key)
        return True
    except S3Error:
        return False


async def put_bytes(object_key: str, data: bytes, content_type: str) -> None:
    """서버 측에서 오브젝트를 직접 적재(산출물 문서화, ai-outputs-backend §7)."""

    def _put() -> None:
        get_minio().put_object(
            settings.minio_bucket, object_key, io.BytesIO(data), length=len(data),
            content_type=content_type,
        )

    await asyncio.to_thread(_put)


async def get_bytes(object_key: str) -> bytes:
    """오브젝트 본문 전체를 읽는다(인제스트 워커용)."""

    def _read() -> bytes:
        resp = get_minio().get_object(settings.minio_bucket, object_key)
        try:
            return resp.read()
        finally:
            resp.close()
            resp.release_conn()

    return await asyncio.to_thread(_read)


async def delete_object(object_key: str) -> None:
    """단일 오브젝트 삭제(멱등 — 없는 키도 에러 아님)."""
    await asyncio.to_thread(get_minio().remove_object, settings.minio_bucket, object_key)


async def delete_objects(object_keys: list[str]) -> None:
    """다수 오브젝트 일괄 삭제(폴더 재귀 삭제 위임, folders-backend §2)."""
    keys = [k for k in object_keys if k]
    if not keys:
        return

    def _remove() -> list:
        client = get_minio()
        errors = client.remove_objects(
            settings.minio_bucket, (DeleteObject(k) for k in keys)
        )
        return list(errors)  # 제너레이터를 소비해야 실제 삭제가 일어난다

    await asyncio.to_thread(_remove)
