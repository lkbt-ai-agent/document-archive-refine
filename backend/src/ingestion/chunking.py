"""청킹 (ingestion.md §3-4, ingestion-backend §2-4).

라인 단위로 누적해 약 512토큰 청크를 만들고 인접 청크끼리 약 64토큰을 겹친다(overlap).
토큰 수는 임베딩 모델 토크나이저로 측정한다(tokenizer.count_tokens). 라인 경계에서만
분할하므로 표의 행이 중간에서 잘리지 않는다(표는 행 단위로 보존).
"""

import re

from src.ingestion.tokenizer import count_tokens

TARGET_TOKENS = 512
OVERLAP_TOKENS = 64
_SENT = re.compile(r"(?<=[.!?。?!])\s+")


async def _split_long_line(line: str) -> list[str]:
    """한 라인이 목표를 넘으면 문장→단어 순으로 쪼갠다(드문 경우)."""
    out: list[str] = []
    cur: list[str] = []
    tok = 0
    for sent in _SENT.split(line):
        c = await count_tokens(sent)
        if tok + c > TARGET_TOKENS and cur:
            out.append(" ".join(cur))
            cur, tok = [], 0
        if c > TARGET_TOKENS:
            # 단어 윈도우로 강제 분할
            words = sent.split(" ")
            step = max(1, len(words) * TARGET_TOKENS // max(c, 1))
            for i in range(0, len(words), step):
                out.append(" ".join(words[i : i + step]))
            continue
        cur.append(sent)
        tok += c
    if cur:
        out.append(" ".join(cur))
    return out


async def chunk_text(text: str) -> list[str]:
    lines = text.split("\n")
    chunks: list[str] = []
    cur: list[tuple[str, int]] = []  # (line, token_count)
    cur_tok = 0

    def flush() -> None:
        if cur:
            chunks.append("\n".join(line for line, _ in cur))

    for line in lines:
        ct = await count_tokens(line) if line.strip() else 0
        if ct > TARGET_TOKENS:
            flush()
            cur.clear()
            cur_tok = 0
            chunks.extend(await _split_long_line(line))
            continue
        if cur_tok + ct > TARGET_TOKENS and cur:
            flush()
            # overlap: 끝에서부터 약 OVERLAP_TOKENS만큼 라인을 이월
            tail: list[tuple[str, int]] = []
            ttok = 0
            for item in reversed(cur):
                if ttok >= OVERLAP_TOKENS and tail:
                    break
                tail.insert(0, item)
                ttok += item[1]
            cur = tail
            cur_tok = sum(c for _, c in cur)
        cur.append((line, ct))
        cur_tok += ct
    flush()

    return [c for c in chunks if c.strip()]
