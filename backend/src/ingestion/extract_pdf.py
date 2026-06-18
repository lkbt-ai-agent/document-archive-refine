"""PDF 추출 (ingestion.md §3-2, ingestion-backend §2-2).

본문 텍스트(pdfplumber)와 표(markdown 직렬화)를 추출하고, 텍스트가 거의 없는 스캔 페이지는
pdf2image로 래스터 렌더해 OCR로 보낸다. 한 페이지 실패는 격리해 문서 전체를 중단시키지 않는다.
intrinsic 메타(쪽수·작성자·날짜)는 pypdf로 읽는다.
"""

import io
import logging
from datetime import datetime

import pdfplumber
from pdf2image import convert_from_bytes
from pypdf import PdfReader

from src.ingestion.ocr import ocr_image

logger = logging.getLogger("mechive.pdf")

SCAN_TEXT_THRESHOLD = 20  # 이 글자 수 미만 + 이미지 존재 → 스캔 페이지로 보고 OCR
OCR_DPI = 200


def _table_to_md(table: list[list]) -> str:
    rows = [[(c or "").replace("\n", " ").strip() for c in row] for row in table if row]
    if not rows:
        return ""
    header, body = rows[0], rows[1:]
    out = ["| " + " | ".join(header) + " |", "| " + " | ".join("---" for _ in header) + " |"]
    out += ["| " + " | ".join(r) + " |" for r in body]
    return "\n".join(out)


def _ocr_page(data: bytes, page_index: int) -> str:
    """풀페이지를 래스터 렌더해 OCR. 실패는 격리(빈 문자열 반환)."""
    try:
        images = convert_from_bytes(
            data, dpi=OCR_DPI, first_page=page_index + 1, last_page=page_index + 1
        )
        return ocr_image(images[0]) if images else ""
    except Exception as exc:  # noqa: BLE001
        logger.warning("페이지 %d OCR 실패(격리): %s", page_index, exc)
        return ""


def _pdf_meta(data: bytes) -> dict:
    try:
        reader = PdfReader(io.BytesIO(data))
        info = reader.metadata
        if info is None:
            return {}
        created = info.creation_date if hasattr(info, "creation_date") else None
        modified = info.modification_date if hasattr(info, "modification_date") else None
        return {
            "author": info.author,
            "intrinsic_title": info.title,
            "doc_created_at": created if isinstance(created, datetime) else None,
            "doc_modified_at": modified if isinstance(modified, datetime) else None,
        }
    except Exception as exc:  # noqa: BLE001
        logger.warning("PDF 메타 읽기 실패: %s", exc)
        return {}


def extract_pdf(data: bytes) -> dict:
    texts: list[str] = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        page_count = len(pdf.pages)
        for i, page in enumerate(pdf.pages):
            body = page.extract_text() or ""
            if len(body.strip()) < SCAN_TEXT_THRESHOLD and page.images:
                body = _ocr_page(data, i)  # 스캔 페이지
            tables = page.extract_tables() or []
            table_md = "\n\n".join(filter(None, (_table_to_md(t) for t in tables)))
            page_text = "\n".join(p for p in (body, table_md) if p.strip())
            if page_text.strip():
                texts.append(page_text)

    meta = _pdf_meta(data)
    meta["page_count"] = page_count
    return {"text": "\n\n".join(texts), "meta": meta}
