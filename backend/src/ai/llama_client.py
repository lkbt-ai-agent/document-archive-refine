"""llama.cpp (llama-server) Provider 구현 (backend.md §8·§9, infrastructure §6).

- LlamaCppLLM: 생성 서버(:8080) `/v1/chat/completions`. `json_schema` 전달 시 GBNF 구조화
  출력을 강제한다(backend §9: 메타 추출·쿼리 파싱·차트 스펙 재사용).
- LlamaCppEmbedding: 임베딩 서버(:8081) `/v1/embeddings`. KURE-v1 1024d 고정.
"""

import httpx

from src.ai.provider import EmbeddingClient, LLMClient
from src.ai.schemas import DecodeParams, LLMResult
from src.config import settings
from src.documents.models import EMBEDDING_DIM

_TIMEOUT = httpx.Timeout(connect=10.0, read=300.0, write=30.0, pool=10.0)


class LlamaCppLLM(LLMClient):
    def __init__(self, base_url: str | None = None) -> None:
        self.base_url = (base_url or settings.llama_chat_url).rstrip("/")

    async def generate(
        self,
        *,
        system: str,
        prompt: str,
        params: DecodeParams,
        json_schema: dict | None = None,
    ) -> LLMResult:
        payload: dict = {
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            "temperature": params.temperature,
            "top_p": params.top_p,
            "top_k": params.top_k,
            "max_tokens": params.max_tokens,
        }
        if params.seed is not None:
            payload["seed"] = params.seed
        if params.extra:
            payload.update(params.extra)
        # 구조화 출력: llama-server는 OpenAI 호환 response_format(json_schema)로 GBNF를 적용한다.
        if json_schema is not None:
            payload["response_format"] = {
                "type": "json_schema",
                "json_schema": {"name": "structured_output", "schema": json_schema, "strict": True},
            }

        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(f"{self.base_url}/v1/chat/completions", json=payload)
            resp.raise_for_status()
            data = resp.json()

        choice = data["choices"][0]
        usage = data.get("usage") or {}
        return LLMResult(
            text=choice["message"]["content"],
            prompt_tokens=usage.get("prompt_tokens"),
            completion_tokens=usage.get("completion_tokens"),
            total_tokens=usage.get("total_tokens"),
            finish_reason=choice.get("finish_reason"),
            model=data.get("model"),
            raw=data,
        )


class LlamaCppEmbedding(EmbeddingClient):
    def __init__(self, base_url: str | None = None) -> None:
        self.base_url = (base_url or settings.llama_embed_url).rstrip("/")

    async def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(
                f"{self.base_url}/v1/embeddings",
                json={"input": texts, "model": "kure-v1"},
            )
            resp.raise_for_status()
            data = resp.json()

        # 입력 순서 보존을 위해 index로 정렬한다.
        rows = sorted(data["data"], key=lambda r: r.get("index", 0))
        vectors = [r["embedding"] for r in rows]
        for v in vectors:
            if len(v) != EMBEDDING_DIM:
                raise ValueError(f"임베딩 차원 불일치: {len(v)} != {EMBEDDING_DIM} (KURE-v1 고정)")
        return vectors
