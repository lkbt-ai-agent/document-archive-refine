"""사이트별 크롤링 추상 인터페이스 (design §3.1, §4).

사이트마다 달라지는 부분(검색 조건, 목록 파싱, 상세 진입, 첨부 추출,
다운로드)을 ``BaseSource`` 하위 클래스 하나로 캡슐화한다.
공통 파이프라인(러너)은 이 인터페이스만 바라본다.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Iterator
from pathlib import Path

from crawler.config import RunConfig
from crawler.models import FileRef, Listing, SearchParams


class BaseSource(ABC):
    """모든 사이트 구현의 베이스.

    하위 클래스는 아래 클래스 속성을 선언한다.

    - ``source_id``: ``sample-datas/<source_id>`` 의 디렉토리명.
    - ``allowed_suffixes``: 이 사이트에서 받을 확장자 화이트리스트(소문자, 점 포함).
    - ``params_model``: 이 사이트의 ``SearchParams`` 하위 클래스.
    """

    source_id: str
    allowed_suffixes: set[str]
    params_model: type[SearchParams]

    def __init__(self, config: RunConfig) -> None:
        self.config = config

    @abstractmethod
    def search(self, params: SearchParams) -> Iterator[Listing]:
        """검색 조건으로 게시글 목록을 순회 반환한다."""
        raise NotImplementedError

    @abstractmethod
    def fetch_files(self, listing: Listing) -> list[FileRef]:
        """상세 페이지에서 첨부 목록을 추출한다."""
        raise NotImplementedError

    @abstractmethod
    def download(self, ref: FileRef, dest_path: Path) -> Path:
        """첨부를 dest_path(러너가 정한 최종 파일 경로)에 저장하고 경로를 반환한다.

        파일명 정책(안전 파일명·날짜 접두·충돌 회피)은 러너/storage가 정한다
        (design §7.4). 사이트는 바이트 전송만 책임진다.
        """
        raise NotImplementedError

    def is_target_file(self, ref: FileRef) -> bool:
        """수집 대상 판정. 기본은 확장자 화이트리스트만 본다 (design §4).

        "청약공고만" 같은 라벨 조건은 사이트가 오버라이드해 더한다.
        """
        return Path(ref.filename).suffix.lower() in self.allowed_suffixes

    def close(self) -> None:
        """열린 리소스(httpx Client, Playwright 세션)를 정리한다. 기본은 무동작."""

    def __enter__(self) -> "BaseSource":
        return self

    def __exit__(self, *exc) -> None:
        self.close()
