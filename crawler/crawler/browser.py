"""브라우저 전략 인프라 (design §5.2).

JS/AJAX로 목록·필터를 그리는 사이트(LH)를 위해 Playwright 세션을 연다.
목록 AJAX 응답은 ``expect_response``로 가로채고,
첨부 다운로드는 ``expect_download`` 이벤트로 받아 원하는 경로에 저장한다.

사용 전 1회: ``uv run playwright install chromium`` (README 참고).
"""

from __future__ import annotations

import json
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import TYPE_CHECKING, Any

from crawler.config import RunConfig

if TYPE_CHECKING:
    from playwright.sync_api import Browser, Page


@contextmanager
def browser_page(config: RunConfig, *, headless: bool = True) -> Iterator["Page"]:
    """Playwright 페이지를 열고 닫는 컨텍스트 매니저.

    ``accept_downloads=True``로 다운로드 이벤트를 받을 수 있게 한다.
    Playwright는 선택적 의존이므로 import는 함수 안에서 한다.
    """
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser: Browser = p.chromium.launch(headless=headless)
        context = browser.new_context(
            accept_downloads=True,
            user_agent=config.user_agent,
        )
        context.set_default_timeout(config.timeout * 1000)
        page = context.new_page()
        try:
            yield page
        finally:
            context.close()
            browser.close()


def capture_json(page: "Page", url_glob: str, action) -> Any:
    """action 실행으로 발생하는 url_glob 매칭 응답을 가로채 JSON으로 반환한다.

    action은 클릭·평가 등 네트워크를 유발하는 콜러블이다 (design §5.2).
    """
    with page.expect_response(url_glob) as resp_info:
        action()
    response = resp_info.value
    body = response.text()
    try:
        return response.json()
    except (json.JSONDecodeError, ValueError):
        return body


def capture_download(page: "Page", dest: Path, action) -> Path:
    """action 실행으로 발생하는 다운로드를 받아 dest에 저장한다 (design §5.2)."""
    with page.expect_download() as dl_info:
        action()
    download = dl_info.value
    dest.parent.mkdir(parents=True, exist_ok=True)
    download.save_as(dest)
    return dest
