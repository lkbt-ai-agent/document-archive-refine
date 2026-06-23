"""중소벤처기업부 사업공고 게시판 크롤러 (research 02, HTTP 전략).

대상: 사업공고 보드 cbIdx=310 (https://www.mss.go.kr/site/smba/ex/bbs/List.do?cbIdx=310).
실측 엔드포인트 (2026-06-23 캡처, research 02 §3):

- 목록: GET ``List.do?cbIdx=<cbIdx>&pageIndex=<n>`` (+ searchPublicDate=YYYY-MM 기간 필터).
        행은 ``<tr onclick="doBbsFView('cbIdx','bcIdx','Gbn','parentSeq')" title="제목">``.
- 상세: GET ``View.do?cbIdx=&bcIdx=&parentSeq=``. 첨부는 상세 HTML의 일반 링크.
        ``<li>`` 안 ``span.name``(원본명)과 ``a[href*="/common/board/Download.do"]``(다운로드).
- 다운로드: GET ``/common/board/Download.do?bcIdx=&cbIdx=&streFileNm=<uuid>.<ext>``.

키워드 검색은 GET이 막혀 제목을 클라이언트 측에서 대조한다. 연/월은 searchPublicDate로 서버가 거른다 (research 02 §3.4).
"""

from __future__ import annotations

import re
from collections.abc import Iterator
from pathlib import Path
from urllib.parse import urljoin

from selectolax.parser import HTMLParser

from crawler.config import RunConfig
from crawler.http import make_client, stream_to_file
from crawler.models import FileRef, Listing, SearchParams
from crawler.sources.base import BaseSource

_ROOT = "https://www.mss.go.kr"
_BASE = _ROOT + "/site/smba/ex/bbs/"

_VIEW_RE = re.compile(r"doBbsFView\('(\d+)','(\d+)','(\d+)','(\d+)'\)")
_DATE_RE = re.compile(r"\d{4}-\d{2}-\d{2}")
_SIZE_TAIL_RE = re.compile(r"\s*\[[^\]]*\]\s*$")  # 파일명 뒤 "[1.29 MB]" 크기 꼬리


class MssSearchParams(SearchParams):
    """MSS 검색 조건. 키워드는 클라이언트 측 대조, 연/월은 서버 필터 (research 02 §3.4)."""

    cb_idx: int = 310                   # 보드 식별자(기본: 사업공고)
    keyword: str | None = None          # 제목을 클라이언트 측에서 대조
    year: int | None = None             # 기간 필터 연도 → searchPublicDate
    month: int | None = None            # 기간 필터 월(없으면 00=연도 전체)


class MssSource(BaseSource):
    source_id = "mss"
    allowed_suffixes = {".pdf"}
    params_model = MssSearchParams

    def __init__(self, config: RunConfig) -> None:
        super().__init__(config)
        self._client = make_client(config)

    def close(self) -> None:
        self._client.close()

    def search(self, params: SearchParams) -> Iterator[Listing]:
        assert isinstance(params, MssSearchParams)
        list_url = f"{_BASE}List.do"
        public_date = _public_date(params.year, params.month)
        seen: set[str] = set()
        for page in range(1, params.max_pages + 1):
            query = {"cbIdx": str(params.cb_idx), "pageIndex": str(page)}
            if public_date:
                query["searchPublicDate"] = public_date
            resp = self._client.get(list_url, params=query)
            resp.raise_for_status()
            tree = HTMLParser(resp.text)
            rows = tree.css("tr[onclick*=doBbsFView]")
            if not rows:
                break
            for row in rows:
                match = _VIEW_RE.search(row.attributes.get("onclick") or "")
                if not match:
                    continue
                cb_idx, bc_idx, _gbn, parent_seq = match.groups()
                if bc_idx in seen:
                    continue
                title = _row_title(row)
                if params.keyword and params.keyword not in title:  # 클라이언트 측 키워드 필터
                    continue
                seen.add(bc_idx)
                yield Listing(
                    source_id=self.source_id,
                    post_id=bc_idx,
                    title=title,
                    posted_at=_row_date(row),
                    detail_ref=f"{_BASE}View.do?cbIdx={cb_idx}&bcIdx={bc_idx}&parentSeq={parent_seq}",
                )

    def fetch_files(self, listing: Listing) -> list[FileRef]:
        resp = self._client.get(listing.detail_ref)
        resp.raise_for_status()
        tree = HTMLParser(resp.text)
        refs: list[FileRef] = []
        for anchor in tree.css('a[href*="/common/board/Download.do"]'):
            href = anchor.attributes.get("href") or ""
            if not href:
                continue
            name = _attach_name(anchor)
            if not name:
                continue
            refs.append(FileRef(filename=name, label=name, file_url=urljoin(_ROOT, href)))
        return refs

    def is_target_file(self, ref: FileRef) -> bool:
        """사업공고 PDF만 통과: 확장자 .pdf + 파일명에 "공고" (research 02 §3.3)."""
        return ref.filename.lower().endswith(".pdf") and "공고" in ref.filename

    def download(self, ref: FileRef, dest_path: Path) -> Path:
        assert ref.file_url is not None
        stream_to_file(self._client, "GET", ref.file_url, dest_path, headers={"referer": _BASE})
        return dest_path


def _public_date(year: int | None, month: int | None) -> str | None:
    """연/월을 searchPublicDate(YYYY-MM)로 만든다. 월이 없으면 00=연도 전체 (research 02 §3.4)."""
    if year is None:
        return None
    return f"{year:04d}-{(month or 0):02d}"


def _row_title(row) -> str:
    """행 제목을 tr의 title 속성에서, 없으면 제목 링크 텍스트에서 읽는다."""
    title = (row.attributes.get("title") or "").strip()
    if title:
        return title
    anchor = row.css_first("td.subject a") or row.css_first("a.pc-detail")
    return " ".join((anchor.text() if anchor else "").split())


def _row_date(row) -> str | None:
    """행의 칸 중 등록일(YYYY-MM-DD) 형식을 찾아 돌려준다."""
    for cell in row.css("td"):
        match = _DATE_RE.search(cell.text() or "")
        if match:
            return match.group(0)
    return None


def _attach_name(anchor) -> str:
    """다운로드 링크가 속한 li에서 원본 파일명을 읽고 뒤의 크기 꼬리를 떼어 낸다."""
    node = anchor
    while node is not None and node.tag != "li":
        node = node.parent
    name_node = node.css_first("span.name") if node is not None else None
    if name_node is None:
        return ""
    return _SIZE_TAIL_RE.sub("", " ".join((name_node.text() or "").split())).strip()
