"""source_id → Source 등록표 (design §3.2).

러너는 사용자가 준 ``source_id``로 이 표에서 사이트 구현을 꺼낸다.
새 출처는 여기에 한 줄만 등록한다.
"""

from __future__ import annotations

from crawler.sources.base import BaseSource
from crawler.sources.lh import LhSource
from crawler.sources.mss import MssSource
from crawler.sources.sh import ShSource

# source_id 문자열 → BaseSource 하위 클래스
REGISTRY: dict[str, type[BaseSource]] = {
    ShSource.source_id: ShSource,
    LhSource.source_id: LhSource,
    MssSource.source_id: MssSource,
}


def get_source_cls(source_id: str) -> type[BaseSource]:
    """등록된 사이트 구현을 돌려준다. 없으면 KeyError로 알린다."""
    try:
        return REGISTRY[source_id]
    except KeyError as exc:
        known = ", ".join(sorted(REGISTRY))
        raise KeyError(f"알 수 없는 source_id={source_id!r}. 등록된 값: {known}") from exc
