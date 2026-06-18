"""임베딩 모델 토크나이저 접근 (ingestion-backend §2-4).

청킹은 문자 수 근사가 아니라 임베딩 모델(KURE-v1)의 실제 토크나이저로 측정해야 한다.
llama-server(:8081)의 `/tokenize`를 호출해 토큰 수를 센다.
"""

import httpx

from src.config import settings

_TIMEOUT = httpx.Timeout(60.0)


async def count_tokens(text: str) -> int:
    if not text:
        return 0
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(
            f"{settings.llama_embed_url.rstrip('/')}/tokenize", json={"content": text}
        )
        resp.raise_for_status()
        return len(resp.json().get("tokens", []))
