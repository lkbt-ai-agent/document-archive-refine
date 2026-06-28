"""생성 서버(:8080) 토큰 수 측정 (lesson 05, search-and-rag).

RAG 컨텍스트를 슬롯 컨텍스트(입력+출력 합산 한도) 안에 맞추려면 생성 모델 기준 토큰 수가
필요하다. 생성 모델 토크나이저는 인프로세스에 없으므로 llama-server `/tokenize`로 센다.
호출은 요청당 소수(시스템·질문·청크 단위)로 제한한다. 라인 단위 반복 호출은 금지한다(lesson 03).
"""

import httpx

from src.config import settings

_TIMEOUT = httpx.Timeout(connect=10.0, read=30.0, write=10.0, pool=10.0)


async def count_chat_tokens(text: str) -> int:
    """생성 서버 `/tokenize`로 토큰 수를 센다. 실패하면 글자 수로 보수 근사한다."""
    if not text:
        return 0
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(
                f"{settings.llama_chat_url.rstrip('/')}/tokenize",
                json={"content": text},
            )
            resp.raise_for_status()
            return len(resp.json().get("tokens", []))
    except Exception:  # noqa: BLE001  # 측정 실패는 치명적이지 않다, 보수 근사로 진행
        # 한국어는 대략 글자당 1토큰 이상이라 글자 수를 보수적 상한으로 본다.
        return len(text)


async def fit_text_to_tokens(text: str, max_tokens: int) -> str:
    """text를 max_tokens 이하가 되도록 근사 절단한다(글자 비율로 자른 뒤 1회 재확인)."""
    if max_tokens <= 0:
        return ""
    tokens = await count_chat_tokens(text)
    if tokens <= max_tokens:
        return text
    keep = max(1, int(len(text) * max_tokens / tokens))
    cut = text[:keep]
    if await count_chat_tokens(cut) > max_tokens:
        cut = cut[: max(1, int(len(cut) * 0.9))]
    return cut
