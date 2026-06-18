"""MinIO 클라이언트 구성 (document-backend §3, infrastructure §4).

원격 단일 공인 IP 엔드포인트라 서버·브라우저가 같은 URL을 쓴다(presign 치환 불필요).
버킷은 02-infra A4에서 보장된다(여기서 생성하지 않음).
"""

from functools import lru_cache
from urllib.parse import urlparse

from minio import Minio

from src.config import settings


@lru_cache
def get_minio() -> Minio:
    """`MINIO_ENDPOINT`(scheme 포함)에서 host:port와 secure 여부를 파싱해 클라이언트를 만든다."""
    parsed = urlparse(settings.minio_endpoint)
    host = parsed.netloc or parsed.path  # scheme 없이 들어오는 경우 대비
    secure = parsed.scheme == "https" if parsed.scheme else settings.minio_secure
    return Minio(
        host,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=secure,
    )
