"""검색·RAG 서비스 (search-backend §2·§3·§5, search-and-rag §3·§4·§6).

단일 진입에서 모드(키워드/의미/rag)를 받아 출력만 분기한다. 질의 파싱은 GBNF 구조화 출력,
기간은 Python에서 절대 범위로 환산, owner 스코프는 항상 강제. RAG는 의미 검색 결과로
컨텍스트를 조립하고 인용을 강제 생성한다.
"""

import json
import logging
import re
import time
from collections.abc import AsyncIterator
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.ai.provider import get_embedding_client, get_llm_client
from src.ai.schemas import DecodeParams
from src.ai.structured import generate_structured
from src.ai.tokenize import count_chat_tokens, fit_text_to_tokens
from src.config import settings
from src.search.dates import resolve_time
from src.search.repository import SearchRepository
from src.search.schemas import (
    AskRequest,
    AskResponse,
    Citation,
    QueryParse,
    SearchRequest,
    SearchResponse,
    SearchResultItem,
)

logger = logging.getLogger("mechive.search")

_PARSE_SYSTEM = (
    "너는 한국어 검색 질의 분석기다. 사용자 질문에서 재작성 질의, 키워드, 기간 표현, "
    "폴더 힌트를 추출해 JSON으로만 출력한다."
)
# 인용·환각 억제 (search-and-rag §6). 주입 순서: 시스템 → 컨텍스트 → 질문.
_RAG_SYSTEM = (
    "너는 한국어 문서 비서다. 반드시 아래 제공된 문서 컨텍스트에만 근거해 답한다. "
    "컨텍스트에 근거가 없으면 '찾을 수 없습니다'라고만 답한다. "
    "모든 문장 끝에 근거가 된 컨텍스트 번호를 [n] 형식으로 표기한다."
)
_CITATION_RE = re.compile(r"\[(\d+)\]")
# 남은 예산이 이보다 적으면 청크를 잘라 담지 않는다(의미 없는 조각 방지).
_MIN_TRUNCATED_TOKENS = 64
# 잘린 청크 끝에 붙이는 생략 표시(" …")가 차지하는 토큰을 예산에서 미리 뺀다.
_TRUNCATE_SUFFIX = " …"
_TRUNCATE_SUFFIX_TOKENS = 4


def _elapsed_ms(start: float) -> int:
    return int((time.monotonic() - start) * 1000)


def _sse(obj: dict) -> str:
    """SSE 한 이벤트로 직렬화. 한국어 보존 위해 ensure_ascii=False."""
    return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n"


class SearchService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = SearchRepository(session)

    async def search(self, owner_id: UUID, req: SearchRequest) -> SearchResponse:
        start = time.monotonic()
        f = req.filters
        if req.mode == "keyword":
            rows = await self.repo.keyword(
                owner_id, req.q, req.limit, f.folder_id, f.date_from, f.date_to
            )
            items = [self._item(r, score=float(r["score"])) for r in rows]
        else:
            qv = (await get_embedding_client().embed([req.q]))[0]
            rows = await self.repo.semantic(
                owner_id, qv, req.limit, f.folder_id, f.date_from, f.date_to
            )
            items = [self._item(r, score=1.0 - float(r["distance"])) for r in rows]
        return SearchResponse(results=items, elapsed_ms=_elapsed_ms(start))

    @staticmethod
    def _item(row: dict, score: float) -> SearchResultItem:
        return SearchResultItem(
            document_id=row["document_id"],
            chunk_id=row["chunk_id"],
            score=score,
            content=row["content"],
            display_filename=row["display_filename"],
            llm_title=row["llm_title"],
            keywords=row["keywords"] or [],
            folder_id=row["folder_id"],
            created_at=row["created_at"],
        )

    async def _parse_query(self, q: str) -> QueryParse | None:
        try:
            parsed, _ = await generate_structured(
                get_llm_client(),
                system=_PARSE_SYSTEM,
                prompt=f"질문: {q}",
                schema=QueryParse,
                params=DecodeParams(temperature=0.1, max_tokens=256),
            )
            return parsed
        except Exception as exc:  # noqa: BLE001  # 파싱 실패 시 원 질의로 진행
            logger.warning("질의 파싱 실패, 원문 사용: %s", exc)
            return None

    async def _retrieve(self, owner_id: UUID, req: AskRequest) -> tuple[str, list[dict]]:
        """질의 파싱·임베딩·의미 검색까지 수행해 (검색용 질의, 청크 행)을 돌려준다."""
        parsed = await self._parse_query(req.q)
        query = parsed.rewritten_query if parsed and parsed.rewritten_query else req.q
        date_from, date_to = req.filters.date_from, req.filters.date_to
        if parsed and parsed.time_ref:
            rf, rt = resolve_time(parsed.time_ref)
            date_from, date_to = rf or date_from, rt or date_to
        qv = (await get_embedding_client().embed([query]))[0]
        rows = await self.repo.semantic(
            owner_id, qv, req.k, req.filters.folder_id, date_from, date_to
        )
        return query, rows

    async def _assemble_context(
        self, query: str, rows: list[dict]
    ) -> tuple[str, dict[int, dict]]:
        """컨텍스트 토큰 예산을 계산해 청크를 예산만큼만 담는다 (lesson 05)."""
        reserved = await count_chat_tokens(_RAG_SYSTEM) + await count_chat_tokens(query)
        budget = (
            settings.llama_chat_ctx_per_slot
            - settings.rag_max_tokens
            - settings.rag_ctx_margin
            - reserved
        )
        return await self._build_context(rows, budget)

    async def ask(self, owner_id: UUID, req: AskRequest) -> AskResponse:
        start = time.monotonic()
        query, rows = await self._retrieve(owner_id, req)
        if not rows:
            return AskResponse(answer="찾을 수 없습니다.", citations=[], elapsed_ms=_elapsed_ms(start))
        context, mapping = await self._assemble_context(query, rows)
        answer = await self._generate(query, context)
        answer, citations = self._finalize_citations(answer, mapping)
        return AskResponse(answer=answer, citations=citations, elapsed_ms=_elapsed_ms(start))

    async def ask_stream(self, owner_id: UUID, req: AskRequest) -> AsyncIterator[str]:
        """RAG 답변을 SSE로 스트리밍한다(search-backend §5).

        파싱·임베딩·검색을 먼저 끝낸 뒤 생성 토큰을 `delta` 이벤트로 흘려보낸다. 생성 완료 후
        전체 답변으로 인용을 재번호·근거 본문과 함께 만들어 `done` 이벤트로 확정한다. 진행 중에는
        원 번호가 보이고 done에서 재번호된 최종 답변으로 교체한다(번호 흔들림 최소화).
        """
        start = time.monotonic()
        query, rows = await self._retrieve(owner_id, req)
        if not rows:
            yield _sse(
                {"type": "done", "answer": "찾을 수 없습니다.", "citations": [], "elapsed_ms": _elapsed_ms(start)}
            )
            return
        context, mapping = await self._assemble_context(query, rows)
        prompt = f"컨텍스트:\n{context}\n\n질문: {query}"
        parts: list[str] = []
        async for delta in get_llm_client().generate_stream(
            system=_RAG_SYSTEM,
            prompt=prompt,
            params=DecodeParams(temperature=0.2, max_tokens=settings.rag_max_tokens),
        ):
            parts.append(delta)
            yield _sse({"type": "delta", "text": delta})
        answer, citations = self._finalize_citations("".join(parts).strip(), mapping)
        yield _sse(
            {
                "type": "done",
                "answer": answer,
                "citations": [c.model_dump(mode="json") for c in citations],
                "elapsed_ms": _elapsed_ms(start),
            }
        )

    async def _build_context(
        self, rows: list[dict], budget: int
    ) -> tuple[str, dict[int, dict]]:
        """컨텍스트 조립 + [n]↔청크 매핑 저장 (search-and-rag §4-4).

        토큰 예산 안에서 청크를 순서대로 담는다. 누적이 예산을 넘으면 멈추고, 단독으로 예산을
        넘는 청크는 남은 예산만큼 잘라 담아 최소 한 청크를 보장한다(lesson 05). 매핑에는 실제로
        담은 청크만 남겨 인용 번호가 어긋나지 않게 하며, 인용 근거 표시용으로 원본 청크 본문을
        함께 보관한다(잘라 담아도 근거는 전체 본문을 보여준다, search-backend §5).
        """
        blocks: list[str] = []
        mapping: dict[int, dict] = {}
        used = 0
        for r in rows:
            i = len(blocks) + 1
            title = r["llm_title"] or r["display_filename"]
            date = r["created_at"].date().isoformat()
            header = f"[{i}] (제목: {title} · 날짜: {date})\n"
            full = header + r["content"]
            tokens = await count_chat_tokens(full)
            if used + tokens <= budget:
                blocks.append(full)
                mapping[i] = r
                used += tokens
                continue
            # 예산 초과 청크: 남은 예산만큼 잘라 담고 종료(첫 청크면 예산 전체를 허용).
            remaining = budget if not blocks else budget - used
            body_budget = (
                remaining - await count_chat_tokens(header) - _TRUNCATE_SUFFIX_TOKENS
            )
            if body_budget >= _MIN_TRUNCATED_TOKENS:
                body = await fit_text_to_tokens(r["content"], body_budget)
                blocks.append(header + body + _TRUNCATE_SUFFIX)
                mapping[i] = r
            break
        return "\n\n".join(blocks), mapping

    async def _generate(self, query: str, context: str) -> str:
        prompt = f"컨텍스트:\n{context}\n\n질문: {query}"
        result = await get_llm_client().generate(
            system=_RAG_SYSTEM,
            prompt=prompt,
            params=DecodeParams(temperature=0.2, max_tokens=settings.rag_max_tokens),
        )
        return result.text.strip()

    @staticmethod
    def _finalize_citations(
        answer: str, mapping: dict[int, dict]
    ) -> tuple[str, list[Citation]]:
        """인용 번호를 1부터 다시 매기고 근거 본문을 채운다 (search-backend §5).

        컨텍스트 번호 n은 검색 순위 위치라 모델이 일부만 인용하면 3, 5처럼 보인다. 답변에서 실제
        인용된 번호를 첫 등장 순서로 모아 1..N으로 remap하고, 답변 텍스트의 `[n]`과 citations의
        n을 같은 매핑으로 함께 바꾼다. 인용되지 않은 청크는 제외한다.
        """
        order: list[int] = []
        seen: set[int] = set()
        for m in _CITATION_RE.finditer(answer):
            n = int(m.group(1))
            if n not in seen and n in mapping:
                seen.add(n)
                order.append(n)
        remap = {old: new for new, old in enumerate(order, start=1)}
        new_answer = _CITATION_RE.sub(
            lambda m: f"[{remap[int(m.group(1))]}]" if int(m.group(1)) in remap else m.group(0),
            answer,
        )
        citations = [
            Citation(
                n=remap[old],
                chunk_id=mapping[old]["chunk_id"],
                document_id=mapping[old]["document_id"],
                content=mapping[old]["content"],
            )
            for old in order
        ]
        return new_answer, citations
