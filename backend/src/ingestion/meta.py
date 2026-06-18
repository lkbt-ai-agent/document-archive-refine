"""메타데이터 생성 (ingestion.md §3-3, ingestion-backend §2-3).

언어는 langdetect로 감지하고, 제목·요약·토픽·키워드는 LLM 구조화 출력(GBNF)으로 생성한다.
MVP는 읽기 전용 표시(사용자 보정 없음).
"""

from langdetect import DetectorFactory, detect

from src.ai.provider import get_llm_client
from src.ai.schemas import DecodeParams
from src.ai.structured import generate_structured
from pydantic import BaseModel, Field

DetectorFactory.seed = 0  # 결정적 감지

_META_SYSTEM = (
    "너는 한국어 문서 분석기다. 주어진 문서를 읽고 제목, 3~5문장 요약, "
    "핵심 토픽과 키워드를 한국어로 생성해 JSON으로만 출력한다."
)
_MAX_CHARS = 6000  # 컨텍스트 한도 고려(A.X 4.0 Light 8192 ctx)


class DocMeta(BaseModel):
    title: str = Field(description="문서 제목")
    summary: str = Field(description="3~5문장 한국어 요약")
    topics: list[str] = Field(description="주요 토픽")
    keywords: list[str] = Field(description="핵심 키워드")


def detect_language(text: str) -> str | None:
    sample = text.strip()[:2000]
    if not sample:
        return None
    try:
        return detect(sample)
    except Exception:  # noqa: BLE001
        return None


async def generate_meta(text: str) -> DocMeta:
    llm = get_llm_client()
    prompt = f"다음 문서의 메타데이터를 생성하라.\n\n{text[:_MAX_CHARS]}"
    meta, _ = await generate_structured(
        llm,
        system=_META_SYSTEM,
        prompt=prompt,
        schema=DocMeta,
        params=DecodeParams(temperature=0.2, max_tokens=512),
    )
    return meta
