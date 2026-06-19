"""공통 데이터 모델 (design §4).

사이트마다 검색 조건은 ``SearchParams`` 하위 클래스로 다르게 정의한다.
목록 한 건은 ``Listing``, 첨부 한 건은 ``FileRef``로 표현한다.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class SearchParams(BaseModel):
    """검색 조건 기반형. 사이트별로 필드를 추가한 하위 클래스를 쓴다.

    공통 필드는 목록 탐색 범위 ``max_pages``뿐이다 (design §4).
    """

    max_pages: int = Field(default=1, ge=1)


class Listing(BaseModel):
    """게시글 목록 한 건."""

    source_id: str
    post_id: str                       # 사이트 고유 게시글 식별자
    title: str
    posted_at: str | None = None       # 등록일(YYYY-MM-DD 또는 원문 문자열)
    detail_ref: str                    # 상세 참조 URL(manifest source_url에 기록)
    extra: dict = Field(default_factory=dict)  # 상세·첨부 조회에 필요한 사이트별 파라미터


class FileRef(BaseModel):
    """첨부 한 건."""

    filename: str                      # 사이트가 제공한 원본 파일명
    label: str | None = None           # 첨부 라벨(예: "입주자모집공고")
    file_url: str | None = None        # 직접 다운로드 URL(있으면)
    download_hint: dict = Field(default_factory=dict)  # 간접 다운로드 정보(클릭 대상 등)


class ManifestEntry(BaseModel):
    """manifest.jsonl 1행 (design §2.2)."""

    post_id: str
    title: str
    filename: str
    source_url: str | None = None      # 상세 페이지 URL
    file_url: str | None = None        # 첨부 다운로드 URL
    sha256: str
    size_bytes: int
    downloaded_at: str                 # ISO-8601
