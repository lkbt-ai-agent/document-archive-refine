"""Provider 추상화 + 팩토리 (backend.md §8).

`LLM_PROVIDER`/`EMBEDDING_PROVIDER` 설정으로 구체 구현을 분기한다. 임베딩은 로컬 고정
(차원 lock-in)이라 llama만 허용한다.
"""

from collections.abc import AsyncIterator
from typing import Protocol

from src.ai.schemas import DecodeParams, LLMResult
from src.config import settings


class LLMClient(Protocol):
    async def generate(
        self,
        *,
        system: str,
        prompt: str,
        params: DecodeParams,
        json_schema: dict | None = None,
    ) -> LLMResult: ...

    def generate_stream(
        self, *, system: str, prompt: str, params: DecodeParams
    ) -> AsyncIterator[str]:
        """생성 텍스트 델타를 차례로 흘려보낸다(RAG 스트리밍, search-backend §5)."""
        ...


class EmbeddingClient(Protocol):
    async def embed(self, texts: list[str]) -> list[list[float]]: ...


def get_llm_client() -> LLMClient:
    if settings.llm_provider == "llama":
        from src.ai.llama_client import LlamaCppLLM

        return LlamaCppLLM()
    if settings.llm_provider == "bedrock":
        from src.ai.bedrock_client import BedrockLLM

        return BedrockLLM()
    raise ValueError(f"unknown LLM_PROVIDER: {settings.llm_provider}")


def get_embedding_client() -> EmbeddingClient:
    if settings.embedding_provider == "llama":
        from src.ai.llama_client import LlamaCppEmbedding

        return LlamaCppEmbedding()
    raise ValueError(f"unknown EMBEDDING_PROVIDER: {settings.embedding_provider}")
