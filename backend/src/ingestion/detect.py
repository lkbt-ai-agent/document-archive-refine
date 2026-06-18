"""파일 타입 감지 — 내용 기반 (ingestion.md §3-1, ingestion-backend §2-1).

확장자를 신뢰하지 않고 magic bytes(filetype)로 PDF/이미지를 판별하고, 그 외 텍스트는
인코딩 디코딩 가능 여부로 확인한 뒤 마크다운/평문을 구조 힌트로 구분한다.
"""

import re

import filetype

PDF = "pdf"
IMAGE = "image"
MARKDOWN = "markdown"
TEXT = "text"
BINARY = "binary"

_MD_HINTS = re.compile(r"(?m)^(#{1,6}\s|\s*[-*+]\s|\s*\d+\.\s|```|\|.+\|)")


def _looks_markdown(text: str) -> bool:
    return bool(_MD_HINTS.search(text))


def detect_kind(data: bytes, filename: str | None = None) -> str:
    kind = filetype.guess(data)
    if kind is not None:
        if kind.mime == "application/pdf":
            return PDF
        if kind.mime.startswith("image/"):
            return IMAGE
        return BINARY  # 지원하지 않는 바이너리

    # 텍스트 계열: 디코딩 가능하면 마크다운/평문 구분
    from charset_normalizer import from_bytes

    best = from_bytes(data).best()
    if best is None:
        return BINARY
    text = str(best)
    # 확장자는 신뢰하지 않되, .md 힌트는 보조로만 활용
    if _looks_markdown(text) or (filename or "").lower().endswith(".md"):
        return MARKDOWN
    return TEXT
