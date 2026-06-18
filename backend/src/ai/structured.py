"""구조화 출력 공통 래퍼 (backend.md §9).

Pydantic 모델로부터 JSON Schema를 만들어 llama.cpp GBNF 출력을 강제하고, 응답을 파싱·검증해
모델 인스턴스로 돌려준다. 재사용처: 메타 추출(ingestion)·쿼리 파싱(search)·차트 스펙(ai-outputs).
"""

import json
from typing import TypeVar

from pydantic import BaseModel

from src.ai.provider import LLMClient
from src.ai.schemas import DecodeParams, LLMResult

T = TypeVar("T", bound=BaseModel)


async def generate_structured(
    llm: LLMClient,
    *,
    system: str,
    prompt: str,
    schema: type[T],
    params: DecodeParams | None = None,
) -> tuple[T, LLMResult]:
    """`schema`로 출력을 강제해 검증된 인스턴스와 원시 LLMResult를 함께 반환한다."""
    result = await llm.generate(
        system=system,
        prompt=prompt,
        params=params or DecodeParams(),
        json_schema=schema.model_json_schema(),
    )
    parsed = schema.model_validate(json.loads(result.text))
    return parsed, result
