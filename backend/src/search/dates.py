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

    if "작년" in ref or "지난해" in ref:
        return year_range(now.year - 1)
    if "올해" in ref or "금년" in ref:
        return year_range(now.year)
    if "재작년" in ref:
        return year_range(now.year - 2)
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
