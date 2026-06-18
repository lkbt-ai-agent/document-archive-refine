"""AWS Bedrock Provider — 인터페이스 스텁 (system-overview §1, backend.md §8·§12).

MVP는 인터페이스만 정의하고 실구현은 제외한다. `LLM_PROVIDER=bedrock`로 선택되면
명시적 NotImplementedError를 던져, 추후 실구현 위치를 못박는다.
"""

from src.ai.provider import LLMClient
from src.ai.schemas import DecodeParams, LLMResult


class BedrockLLM(LLMClient):
    async def generate(
        self,
        *,
        system: str,
        prompt: str,
        params: DecodeParams,
        json_schema: dict | None = None,
    ) -> LLMResult:
        raise NotImplementedError(
            "BedrockLLM은 MVP 범위 밖(인터페이스만). 실구현은 추후 (backend.md §12)."
        )
