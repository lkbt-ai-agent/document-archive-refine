"""검색·RAG 서비스 (search-backend §2·§3·§5, search-and-rag §3·§4·§6).

단일 진입에서 모드(키워드/의미/rag)를 받아 출력만 분기한다. 질의 파싱은 GBNF 구조화 출력,
기간은 Python에서 절대 범위로 환산, owner 스코프는 항상 강제. RAG는 의미 검색 결과로
컨텍스트를 조립하고 인용을 강제 생성한다.
"""

import logging
import re
import time
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.ai.provider import get_embedding_client, get_llm_client
from src.ai.schemas import DecodeParams
from src.ai.structured import generate_structured
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


def _elapsed_ms(start: float) -> int:
    return int((time.monotonic() - start) * 1000)


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
            original_filename=row["original_filename"],
            llm_title=row["llm_title"],
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

    async def ask(self, owner_id: UUID, req: AskRequest) -> AskResponse:
        start = time.monotonic()
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
        if not rows:
            return AskResponse(answer="찾을 수 없습니다.", citations=[], elapsed_ms=_elapsed_ms(start))

        context, mapping = self._build_context(rows)
        answer = await self._generate(query, context)
        citations = self._citations(answer, mapping)
        return AskResponse(answer=answer, citations=citations, elapsed_ms=_elapsed_ms(start))

    @staticmethod
    def _build_context(rows: list[dict]) -> tuple[str, dict[int, tuple[UUID, UUID]]]:
        """컨텍스트 조립 + [n]↔chunk 매핑 저장 (search-and-rag §4-4)."""
        blocks, mapping = [], {}
        for i, r in enumerate(rows, start=1):
            mapping[i] = (r["chunk_id"], r["document_id"])
            title = r["llm_title"] or r["original_filename"]
            date = r["created_at"].date().isoformat()
            blocks.append(f"[{i}] (제목: {title} · 날짜: {date})\n{r['content']}")
        return "\n\n".join(blocks), mapping

    async def _generate(self, query: str, context: str) -> str:
        prompt = f"컨텍스트:\n{context}\n\n질문: {query}"
        result = await get_llm_client().generate(
            system=_RAG_SYSTEM, prompt=prompt, params=DecodeParams(temperature=0.2, max_tokens=1024)
        )
        return result.text.strip()

    @staticmethod
    def _citations(answer: str, mapping: dict[int, tuple[UUID, UUID]]) -> list[Citation]:
        seen = sorted({int(n) for n in _CITATION_RE.findall(answer)})
        out = []
        for n in seen:
            if n in mapping:
                chunk_id, document_id = mapping[n]
                out.append(Citation(n=n, chunk_id=chunk_id, document_id=document_id))
        return out
