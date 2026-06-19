"""SH 서울주택도시공사 게시판 크롤러 (design §6.1, HTTP 전략).

대상: 임대 게시판 m_247 (https://www.i-sh.co.kr/.../brd/m_247/list.do).
실측 엔드포인트 (2026-06-19 캡처):

- 목록: POST ``list.do`` {page, srchWord, srchTp} (srchTp 0=제목, 1=내용).
        제목 링크는 ``onclick="javascript:getDetailView('<seq>')"``.
- 상세: POST ``view.do`` {page, seq}. HTML 안에
        ``initParam.downList = [{brdId, seq, fileSeq, oriFileNm, fileTp, fileSize}, ...]``.
- 다운로드: GET ``/com/file/innoFD.do?brdId=&seq=&fileSeq=&fileTp=`` (innorix).
"""

from __future__ import annotations

import json
import re
from collections.abc import Iterator
from pathlib import Path
from typing import Literal

from selectolax.parser import HTMLParser

from crawler.config import RunConfig
from crawler.http import make_client, stream_to_file
from crawler.models import FileRef, Listing, SearchParams
from crawler.sources.base import BaseSource

_ROOT = "https://www.i-sh.co.kr"
_BASE = _ROOT + "/app/lay2/program/S48T561C563/www/brd/m_247/"
_DOWNLOAD = _ROOT + "/com/file/innoFD.do"

_SEQ_RE = re.compile(r"getDetailView\('(\d+)'\)")
_DOWNLIST_RE = re.compile(r"initParam\.downList\s*=\s*(\[.*?\])\s*;", re.S)


class ShSearchParams(SearchParams):
    """SH 검색 조건. 게시판 검색은 제목/내용 키워드로 단순하다 (design §6.1.2)."""

    keyword: str | None = None
    search_type: Literal["title", "content"] = "title"  # srchTp 0/1


class ShSource(BaseSource):
    source_id = "sh"
    allowed_suffixes = {".pdf"}
    params_model = ShSearchParams

    def __init__(self, config: RunConfig) -> None:
        super().__init__(config)
        self._client = make_client(config)
        self._client.headers["referer"] = _BASE + "view.do"

    def close(self) -> None:
        self._client.close()

    def search(self, params: SearchParams) -> Iterator[Listing]:
        assert isinstance(params, ShSearchParams)
        srch_tp = "0" if params.search_type == "title" else "1"
        seen: set[str] = set()
        for page in range(1, params.max_pages + 1):
            data = {"page": str(page), "srchWord": params.keyword or "", "srchTp": srch_tp}
            resp = self._client.post(_BASE + "list.do", data=data)
            resp.raise_for_status()
            tree = HTMLParser(resp.text)
            for anchor in tree.css("a[onclick*=getDetailView]"):
                match = _SEQ_RE.search(anchor.attributes.get("onclick") or "")
                if not match:
                    continue
                seq = match.group(1)
                if seq in seen:
                    continue
                seen.add(seq)
                yield Listing(
                    source_id=self.source_id,
                    post_id=seq,
                    title=" ".join((anchor.text() or "").split()),
                    posted_at=_row_date(anchor),
                    detail_ref=f"{_BASE}view.do?seq={seq}",
                )

    def fetch_files(self, listing: Listing) -> list[FileRef]:
        resp = self._client.post(_BASE + "view.do", data={"page": "1", "seq": listing.post_id})
        resp.raise_for_status()
        match = _DOWNLIST_RE.search(resp.text)
        if not match:
            return []
        refs: list[FileRef] = []
        for item in json.loads(match.group(1)):
            name = item.get("oriFileNm") or ""
            url = (
                f"{_DOWNLOAD}?brdId={item['brdId']}&seq={item['seq']}"
                f"&fileSeq={item['fileSeq']}&fileTp={item.get('fileTp', 'A')}"
            )
            refs.append(FileRef(filename=name, label=name, file_url=url))
        return refs

    def is_target_file(self, ref: FileRef) -> bool:
        """청약공고 PDF만 통과: 확장자 .pdf + 파일명에 "공고" (design §6.1.3)."""
        return ref.filename.lower().endswith(".pdf") and "공고" in ref.filename

    def download(self, ref: FileRef, dest_path: Path) -> Path:
        assert ref.file_url is not None
        stream_to_file(self._client, "GET", ref.file_url, dest_path)
        return dest_path


def _row_date(anchor) -> str | None:
    """제목 링크가 속한 행에서 등록일(끝에서 두 번째 칸)을 읽는다."""
    node = anchor
    while node is not None and node.tag != "tr":
        node = node.parent
    if node is None:
        return None
    cells = node.css("td")
    if len(cells) >= 2:
        return " ".join((cells[-2].text() or "").split()) or None
    return None
