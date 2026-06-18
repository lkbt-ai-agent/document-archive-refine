"""레지스트리 시드 (B4, users-schema §2 / generations-schema §1 / models.md).

멱등하게 실행된다: 시드 사용자 1명, 모델 레지스트리(A.X 4.0 Light·KURE-v1).

실행: `uv run python -m src.seed`
"""

import asyncio

from sqlalchemy import text

from src.database import engine
from src.users.constants import SEED_USER_ID

# 모델 레지스트리 (models.md). file_path는 개발 Mac mini 기준.
MODELS = [
    {
        "name": "A.X-4.0-Light",
        "file_path": "~/Desktop/models/a.x-4.0-light-q4_k_m.gguf",
        "quantization": "Q4_K_M",
        "context_window": 8192,
        "provider": "llama.cpp",
    },
    {
        "name": "KURE-v1",
        "file_path": "~/Desktop/models/kure-v1-q8_0.gguf",
        "quantization": "Q8_0",
        "context_window": 8192,
        "provider": "llama.cpp",
    },
]

async def seed() -> None:
    async with engine.begin() as conn:
        # 시드 사용자 (고정 UUID)
        await conn.execute(
            text("INSERT INTO archive.users (id) VALUES (:id) ON CONFLICT (id) DO NOTHING"),
            {"id": SEED_USER_ID},
        )

        # 모델 레지스트리 (name 중복 방지)
        for m in MODELS:
            await conn.execute(
                text(
                    """
                    INSERT INTO archive.models
                        (name, file_path, quantization, context_window, provider)
                    SELECT :name, :file_path, :quantization, :context_window, :provider
                    WHERE NOT EXISTS (SELECT 1 FROM archive.models WHERE name = :name)
                    """
                ),
                m,
            )

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
    print("seed 완료: users(1) + models(2)")
