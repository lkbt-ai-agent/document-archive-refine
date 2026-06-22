"""추출 본문 정제 단위 시험 (lessons/02, plan 04 D3)."""

from src.ingestion.sanitize import sanitize_text


def test_removes_nul_byte():
    assert sanitize_text("가\x00나") == "가나"


def test_removes_other_c0_controls():
    # BEL(07)·BS(08)·VT(0b)·FF(0c)·ESC(1b) 등은 제거한다.
    assert sanitize_text("a\x07b\x08c\x0bd\x0ce\x1bf") == "abcdef"


def test_preserves_tab_lf_cr():
    # 탭(09)·LF(0a)·CR(0d)은 보존한다.
    text = "줄1\t열2\n줄2\r\n끝"
    assert sanitize_text(text) == text


def test_preserves_normal_unicode():
    text = "한글 ABC 123 — 표🟢"
    assert sanitize_text(text) == text


def test_empty_string():
    assert sanitize_text("") == ""
