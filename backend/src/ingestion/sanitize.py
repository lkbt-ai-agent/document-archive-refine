"""추출 본문 정제 (docs/lessons/02-pdf-nul-byte-chunk-insert.md).

PDF 추출기가 흘리는 NUL(0x00)과 비허용 C0 제어 문자를 제거한다. PostgreSQL text
컬럼은 NUL을 저장하지 못하므로 청크 적재 전에 반드시 걸러야 한다.

탭(\\x09)·LF(\\x0a)·CR(\\x0d)은 정상 텍스트 구조라 보존하고, 나머지 C0
(\\x00-\\x08·\\x0b·\\x0c·\\x0e-\\x1f)는 제거한다.
"""

import re

# 탭(09)·LF(0a)·CR(0d)을 제외한 C0 제어 문자.
_C0_STRIP = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")


def sanitize_text(text: str) -> str:
    """NUL과 비허용 C0 제어 문자를 제거한다. 탭·LF·CR은 보존한다."""
    return _C0_STRIP.sub("", text)
