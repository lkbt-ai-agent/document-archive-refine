"""TXT/MD 추출 (ingestion.md §3-2, ingestion-backend §2-2).

TXT: charset-normalizer로 안전 디코딩(EUC-KR은 상위집합 CP949로). 크래시 금지.
MD: 평문화하지 않고 구조(헤더 등)를 그대로 보존한다(헤더 인지 청킹은 chunking에서).
"""

from charset_normalizer import from_bytes


def decode_text(data: bytes) -> str:
    """인코딩을 안전 해석한다. 실패해도 예외 없이 대체 문자로 디코딩."""
    best = from_bytes(data).best()
    if best is not None:
        return str(best)
    return data.decode("utf-8", errors="replace")


def extract_txt(data: bytes) -> str:
    return decode_text(data)


def extract_md(data: bytes) -> str:
    # 구조 보존: 원문 그대로 둔다(헤더/리스트/표 마크업 유지).
    return decode_text(data)
