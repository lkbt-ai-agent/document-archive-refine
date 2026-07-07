"""상대적 날짜 해석 (search-and-rag §3).

"작년" 등 한국어 상대 기간 표현을 요청 시각 기준 절대 범위로 환산한다(Python에서 결정적 처리).
해석 불가 시 (None, None).
"""

import re
from datetime import UTC, datetime, timedelta


def resolve_time(time_ref: str | None, now: datetime | None = None) -> tuple[datetime | None, datetime | None]:
    if not time_ref:
        return None, None
    now = now or datetime.now(UTC)
    ref = time_ref.strip()

    def year_range(y: int) -> tuple[datetime, datetime]:
        return datetime(y, 1, 1, tzinfo=UTC), datetime(y, 12, 31, 23, 59, 59, tzinfo=UTC)

    def month_range(y: int, m: int) -> tuple[datetime, datetime]:
        start = datetime(y, m, 1, tzinfo=UTC)
        end = (datetime(y + 1, 1, 1, tzinfo=UTC) if m == 12 else datetime(y, m + 1, 1, tzinfo=UTC))
        return start, end - timedelta(seconds=1)

    if "재작년" in ref:  # "작년"보다 먼저 검사한다(재작년이 작년에 먼저 걸리는 것 방지)
        return year_range(now.year - 2)
    if "작년" in ref or "지난해" in ref:
        return year_range(now.year - 1)
    if "올해" in ref or "금년" in ref:
        return year_range(now.year)
    if "지난달" in ref or "지난 달" in ref:
        y, m = (now.year - 1, 12) if now.month == 1 else (now.year, now.month - 1)
        return month_range(y, m)
    if "이번달" in ref or "이번 달" in ref:
        return month_range(now.year, now.month)

    m = re.search(r"최근\s*(\d+)\s*일", ref)
    if m:
        return now - timedelta(days=int(m.group(1))), now
    m = re.search(r"(\d+)\s*년", ref)
    if m and len(m.group(1)) == 4:
        return year_range(int(m.group(1)))
    return None, None


# resolve_time이 이해하는 기간 표현. 재작년을 작년보다 먼저 둬 부분 일치를 막고,
# 연도는 정확히 4자리(앞뒤가 숫자가 아님)만 잡아 resolve_time의 판정과 일치시킨다.
_TIME_REF_RE = re.compile(
    r"재작년|지난해|작년|금년|올해|지난\s*달|이번\s*달|최근\s*\d+\s*일|(?<!\d)\d{4}(?!\d)\s*년"
)


def extract_time_ref(query: str) -> tuple[str | None, str]:
    """원문 질의에서 기간 표현 하나를 뽑고, 그 표현을 제거한 잔여 질의를 함께 돌려준다.

    LLM 대신 코드가 상대·절대 기간을 추출해 날짜 환각을 막는다(plan 15-rag-relative-date-fix).
    뽑은 표현은 resolve_time에 그대로 넘길 수 있게 내부 공백을 하나로 정규화한다.
    """
    m = _TIME_REF_RE.search(query)
    if not m:
        return None, query
    expr = re.sub(r"\s+", " ", m.group(0))
    remaining = re.sub(r"\s+", " ", query[: m.start()] + " " + query[m.end() :]).strip()
    return expr, remaining
