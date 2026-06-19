"""애플리케이션 설정 (backend.md §6).

`.env`(리포 루트, `.gitignore` 대상)에서 원격 PG/MinIO/Redis/llama URL과
Provider 선택을 읽어 단일 `settings` 객체로 주입한다. 평문 시크릿은 코드에 두지 않는다.
"""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/src/config.py -> parents[2] == 리포 루트. docker는 환경변수로 주입하므로
# .env 파일이 없어도 동작한다(env_file은 로컬 개발 편의).
_REPO_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(_REPO_ROOT / ".env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # 실행 환경 (dev/prod 분리, backend.md §6)
    app_env: Literal["dev", "prod"] = "dev"

    # PostgreSQL (infrastructure §3) — psycopg3 async 드라이버 문자열
    database_url: str
    db_schema: str = "archive"
    db_ext_schema: str = "archive_ext"
    db_echo: bool = False

    # MinIO (infrastructure §4)
    minio_endpoint: str
    minio_access_key: str
    minio_secret_key: str
    minio_bucket: str
    minio_secure: bool = False  # 원격은 http (운영 전 TLS, infrastructure §8)
    presign_ttl_seconds: int = 600  # 5~15분 (document-backend §3)

    # Redis / arq (infrastructure §5)
    redis_url: str = "redis://localhost:6379/0"

    # llama-server (infrastructure §6)
    llama_chat_url: str = "http://localhost:8080"
    llama_embed_url: str = "http://localhost:8081"

    # Provider 선택 (backend.md §8)
    llm_provider: Literal["llama", "bedrock"] = "llama"
    embedding_provider: Literal["llama"] = "llama"  # 차원 lock-in, 로컬 고정

    # CORS — web 오리진 (backend.md §7)
    cors_origins: list[str] = ["http://localhost:3000"]
    # 추가 허용 오리진 정규식 — 로컬·Tailnet(*.ts.net) 등 호스트명으로 접속 시 사용.
    cors_origin_regex: str = r"https?://(localhost|127\.0\.0\.1|.*\.ts\.net)(:\d+)?"

    @property
    def search_path(self) -> str:
        """연결 시 적용할 search_path (infrastructure §3)."""
        return f"{self.db_schema},{self.db_ext_schema}"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


settings = get_settings()
