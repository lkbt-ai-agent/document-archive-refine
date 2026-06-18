"""OCR (ingestion.md §3-2, ingestion-backend §2-2).

PaddleOCR PP-OCRv5(한국어)를 기본 엔진으로, 실패·저품질 시 Tesseract `kor`로 폴백한다.
엔진은 무겁고 동기라 호출부(pipeline)에서 스레드·타임아웃·재시도로 감싼다. 페이지 단위
부분 실패는 호출부에서 격리한다.
"""

import logging

import pytesseract
from PIL import Image

logger = logging.getLogger("mechive.ocr")

_paddle = None


def _get_paddle():
    global _paddle
    if _paddle is None:
        from paddleocr import PaddleOCR

        # PP-OCRv5 한국어. 최초 호출 시 모델을 받는다.
        _paddle = PaddleOCR(lang="korean", use_textline_orientation=True)
    return _paddle


def _ocr_paddle(img: Image.Image) -> str:
    import numpy as np

    results = _get_paddle().predict(np.array(img.convert("RGB")))
    texts: list[str] = []
    for page in results:
        rec = page["rec_texts"] if "rec_texts" in page else page.get("rec_texts", [])
        texts.extend(rec or [])
    return "\n".join(texts)


def _ocr_tesseract(img: Image.Image) -> str:
    return pytesseract.image_to_string(img, lang="kor+eng")


def ocr_image(img: Image.Image) -> str:
    """단일 이미지 OCR. PaddleOCR 우선, 실패/공백 시 Tesseract 폴백 (동기)."""
    try:
        text = _ocr_paddle(img)
        if text.strip():
            return text
        logger.warning("PaddleOCR 결과 공백 → Tesseract 폴백")
    except Exception as exc:  # noqa: BLE001
        logger.warning("PaddleOCR 실패(%s) → Tesseract 폴백", exc)
    return _ocr_tesseract(img)
