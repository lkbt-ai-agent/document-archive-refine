"""검색·RAG 라우터 (search-backend §1).

단일 진입: 키워드/의미는 POST /search(결과 리스트), rag는 POST /search/ask(답변+인용).
"""

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from src.common.deps import OwnerDep, SessionDep
from src.search.schemas import AskRequest, AskResponse, SearchRequest, SearchResponse
from src.search.service import SearchService

router = APIRouter(prefix="/search", tags=["search"])


@router.post("", response_model=SearchResponse)
async def search(req: SearchRequest, session: SessionDep, owner: OwnerDep) -> SearchResponse:
    return await SearchService(session).search(owner, req)


@router.post("/ask", response_model=AskResponse)
async def ask(req: AskRequest, session: SessionDep, owner: OwnerDep) -> AskResponse:
    return await SearchService(session).ask(owner, req)


@router.post("/ask/stream")
async def ask_stream(req: AskRequest, session: SessionDep, owner: OwnerDep) -> StreamingResponse:
    # SSE 스트리밍 RAG. 비스트리밍 /ask는 폴백으로 유지한다(search-backend §5).
    gen = SearchService(session).ask_stream(owner, req)
    return StreamingResponse(
        gen,
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
