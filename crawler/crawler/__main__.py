"""CLI 진입점 (design §8).

``python -m crawler <source> [옵션]`` 또는 ``uv run crawler <source> [옵션]``.
사이트별 인자는 각 ``params_model`` 필드로 매핑된다.
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

from crawler.config import RunConfig
from crawler.runner import run

# 러너 설정(config)으로 가는 키. 나머지는 검색조건(params)으로 넘긴다.
_CONFIG_KEYS = {"out", "concurrency", "delay"}


def _build_parser() -> argparse.ArgumentParser:
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--out", type=Path, help="출력 루트(기본: 프로젝트 sample-datas/)")
    common.add_argument("--concurrency", type=int, default=1, help="동시 요청 수(기본 1)")
    common.add_argument("--delay", type=float, default=0.7, help="요청 간 지연 초(기본 0.7)")
    common.add_argument("--max-pages", dest="max_pages", type=int, default=1, help="목록 탐색 페이지 수")

    parser = argparse.ArgumentParser(prog="crawler", description="청약공고 테스트 데이터 크롤러")
    sub = parser.add_subparsers(dest="source", required=True)

    sh = sub.add_parser("sh", parents=[common], help="SH 서울주택도시공사")
    sh.add_argument("--keyword", help="제목/내용 검색어")
    sh.add_argument("--search-type", dest="search_type",
                    choices=["title", "content"], default="title", help="검색 구분(기본 제목)")

    lh = sub.add_parser("lh", parents=[common], help="LH 한국토지주택공사")
    lh.add_argument("--category", choices=["임대", "분양", "토지", "상가"], default="임대")
    lh.add_argument("--region", help="지역명(예: 서울) 또는 cnpCd 코드")
    lh.add_argument("--status", choices=["공고중", "접수중", "접수마감", "정정공고중"], help="공고상태")
    lh.add_argument("--keyword", help="공고명 검색어")

    mss = sub.add_parser("mss", parents=[common], help="중소벤처기업부 사업공고")
    mss.add_argument("--cb-idx", dest="cb_idx", type=int, default=310, help="보드 식별자(기본 310 사업공고)")
    mss.add_argument("--year", type=int, help="기간 필터 연도(예: 2026)")
    mss.add_argument("--month", type=int, help="기간 필터 월(생략 시 연도 전체)")
    mss.add_argument("--keyword", help="제목 검색어(클라이언트 측 대조)")
    return parser


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    ns = _build_parser().parse_args(argv)

    config = RunConfig()
    if ns.out is not None:
        config.out_dir = ns.out
    config.concurrency = ns.concurrency
    config.delay = ns.delay

    raw_params = {
        key: value
        for key, value in vars(ns).items()
        if key not in _CONFIG_KEYS and key != "source" and value is not None
    }

    result = run(ns.source, raw_params, config)
    logging.getLogger("crawler").info(
        "완료 source=%s 목록=%d 다운로드=%d 중복=%d 필터=%d 실패=%d → %s",
        result.source_id, result.listings, result.downloaded,
        result.skipped_dup, result.skipped_filtered, result.failures,
        config.source_dir(result.source_id),
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
