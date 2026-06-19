"""LH 한국토지주택공사 청약플러스 크롤러 (design §6.2, HTTP 전략).

대상: 분양·임대 공고 목록 (selectWrtancList.do).
캡처 결과(2026-06-19) LH 목록은 서버 렌더이고 첨부는 AJAX+직링이라
Playwright 없이 httpx로 충분하다 (design §6.2.1의 역설계 POST 대안 채택, plan U3).

실측 엔드포인트:

- 목록: GET ``selectWrtancList.do?mi=<카테고리>`` (+ cnpCd 지역, panSs 상태, panNm 키워드).
        행마다 ``a.wrtancInfoBtn[data-id1=panId, data-id2=ccrCnntSysDsCd,
        data-id3=uppAisTpCd, data-id4=aisTpCd]`` 와
        ``a.listFileDown[data-id1=uppAisTpCd, data-id2=aisTpCd,
        data-id3=ccrCnntSysDsCd, data-id4=lsSst, data-id5=panId]``.
- 첨부목록: POST ``/lhapply/wt/wrtanc/wrtFileDownl.do``
        {uppAisTpCd1, aisTpCd1, ccrCnntSysDsCd1, lsSst1, panId1, csrfToken}
        → JSON ``[{cmnAhflSn, cmnAhflNm}, ...]``.
- 다운로드: GET ``/lhapply/lhFile.do?fileid=<cmnAhflSn>``.
"""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path
from typing import Literal

from selectolax.parser import HTMLParser

from crawler.config import RunConfig
from crawler.http import make_client, stream_to_file
from crawler.models import FileRef, Listing, SearchParams
from crawler.sources.base import BaseSource

_ROOT = "https://apply.lh.or.kr"
_LIST = _ROOT + "/lhapply/apply/wt/wrtanc/selectWrtancList.do"
_FILELIST = _ROOT + "/lhapply/wt/wrtanc/wrtFileDownl.do"
_DOWNLOAD = _ROOT + "/lhapply/lhFile.do"

# 카테고리 → 목록 메뉴 파라미터 mi (design §6.2)
_CATEGORY_MI = {"임대": "1026", "분양": "1027", "토지": "1062", "상가": "1069"}


class LhSearchParams(SearchParams):
    """LH 검색 조건. SH보다 필터가 많다 (design §6.2.2)."""

    category: Literal["임대", "분양", "토지", "상가"] = "임대"
    region: str | None = None                                   # 지역명(예: 서울). 행의 지역 칸을 클라이언트 측에서 대조
    status: Literal["공고중", "접수중", "접수마감", "정정공고중"] | None = None  # panSs(서버 필터)
    keyword: str | None = None                                  # 공고명. 제목을 클라이언트 측에서 대조


class LhSource(BaseSource):
    source_id = "lh"
    allowed_suffixes = {".pdf"}
    params_model = LhSearchParams

    def __init__(self, config: RunConfig) -> None:
        super().__init__(config)
        self._client = make_client(config)
        self._csrf: str | None = None

    def close(self) -> None:
        self._client.close()

    def search(self, params: SearchParams) -> Iterator[Listing]:
        assert isinstance(params, LhSearchParams)
        mi = _CATEGORY_MI[params.category]
        # page 1은 GET(mi[, panSs]). 페이징 파라미터를 GET에 붙이면 빈 스텁이 와서
        # 2페이지부터는 pagingForm을 POST로 재제출한다 (캡처 2026-06-19).
        query = {"mi": mi}
        if params.status:
            query["panSs"] = params.status
        resp = self._client.get(_LIST, params=query)
        resp.raise_for_status()

        seen: set[str] = set()
        for page in range(1, params.max_pages + 1):
            tree = HTMLParser(resp.text)
            self._capture_csrf(tree)
            rows = tree.css("table tbody tr")
            if not rows:
                break
            for row in rows:
                listing = _parse_row(row, mi)
                if listing is None or listing.post_id in seen:
                    continue
                if not _matches(listing, row, params):  # 지역·키워드는 클라이언트 측 필터
                    continue
                seen.add(listing.post_id)
                yield listing
            if page >= params.max_pages:
                break
            payload = _paging_payload(tree)
            if payload is None:
                break
            payload["currPage"] = str(page + 1)
            resp = self._client.post(_LIST, data=payload, headers={"referer": _LIST})
            resp.raise_for_status()

    def fetch_files(self, listing: Listing) -> list[FileRef]:
        payload = dict(listing.extra)            # uppAisTpCd1, aisTpCd1, ccrCnntSysDsCd1, lsSst1, panId1
        payload["csrfToken"] = self._csrf or ""
        resp = self._client.post(
            _FILELIST, data=payload,
            headers={"referer": _LIST, "x-requested-with": "XMLHttpRequest"},
        )
        resp.raise_for_status()
        refs: list[FileRef] = []
        for item in resp.json():
            name = item.get("cmnAhflNm") or ""
            fid = item.get("cmnAhflSn")
            if fid is None:
                continue
            refs.append(FileRef(filename=name, label=name, file_url=f"{_DOWNLOAD}?fileid={fid}"))
        return refs

    def is_target_file(self, ref: FileRef) -> bool:
        """청약공고 PDF만 통과: 확장자 .pdf + 파일명에 "공고" (design §6.2.3)."""
        return ref.filename.lower().endswith(".pdf") and "공고" in ref.filename

    def download(self, ref: FileRef, dest_path: Path) -> Path:
        assert ref.file_url is not None
        stream_to_file(self._client, "GET", ref.file_url, dest_path, headers={"referer": _LIST})
        return dest_path

    def _capture_csrf(self, tree: HTMLParser) -> None:
        node = tree.css_first("input[name=csrfToken]")
        if node is not None:
            self._csrf = node.attributes.get("value")


def _parse_row(row, mi: str) -> Listing | None:
    """목록 한 행에서 공고 식별자와 첨부 조회 파라미터를 뽑는다."""
    info = row.css_first("a.wrtancInfoBtn")
    if info is None:
        return None
    pan_id = info.attributes.get("data-id1") or ""
    if not pan_id:
        return None
    title = " ".join((info.text() or "").split())

    fdn = row.css_first("a.listFileDown")
    if fdn is None:
        return None  # 첨부가 없는 공고는 건너뜀
    extra = {
        "uppAisTpCd1": fdn.attributes.get("data-id1") or "",
        "aisTpCd1": fdn.attributes.get("data-id2") or "",
        "ccrCnntSysDsCd1": fdn.attributes.get("data-id3") or "",
        "lsSst1": fdn.attributes.get("data-id4") or "",
        "panId1": fdn.attributes.get("data-id5") or pan_id,
    }
    region_cell = row.css_first("td.col2")
    region = " ".join((region_cell.text() or "").split()) if region_cell else ""
    return Listing(
        source_id="lh",
        post_id=pan_id,
        title=title,
        posted_at=None,                          # 목록에 정형 날짜 칸이 없어 비움
        detail_ref=f"{_LIST}?mi={mi}#panId={pan_id} ({region})".strip(),
        extra=extra,
    )


def _matches(listing: Listing, row, params: LhSearchParams) -> bool:
    """지역·키워드를 클라이언트 측에서 대조한다(서버 GET 필터가 불안정해서)."""
    if params.region:
        cell = row.css_first("td.col2")
        text = cell.text() if cell else ""
        if params.region not in text:
            return False
    if params.keyword and params.keyword not in listing.title:
        return False
    return True


def _paging_payload(tree: HTMLParser) -> dict | None:
    """현재 페이지의 pagingForm 히든 필드를 모아 다음 페이지 POST 본문으로 쓴다."""
    form = tree.css_first("form#pagingForm") or tree.css_first("form[name=pagingForm]")
    if form is None:
        return None
    return {
        inp.attributes.get("name"): (inp.attributes.get("value") or "")
        for inp in form.css("input")
        if inp.attributes.get("name")
    }
