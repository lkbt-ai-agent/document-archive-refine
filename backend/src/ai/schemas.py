"""AI Provider 공통 데이터 구조 (backend.md §8).

비즈니스 로직은 이 구조와 Protocol(provider.py)에만 의존하고, 구체 Provider(llama/bedrock)는
교체 가능하다. 임베딩 차원은 전 시스템 1024 고정(data-overview §1).
"""

from dataclasses import dataclass, field


@dataclass(slots=True)
class DecodeParams:
    """디코딩 파라미터. 계보 재현성을 위해 생성마다 기록한다(ai-outputs.md §7)."""

    temperature: float = 0.2
    top_p: float = 0.95
    top_k: int = 40
    seed: int | None = None
    max_tokens: int = 2048
    extra: dict = field(default_factory=dict)


@dataclass(slots=True)
class LLMResult:
    text: str
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    total_tokens: int | None = None
    finish_reason: str | None = None
    model: str | None = None
    raw: dict | None = None
