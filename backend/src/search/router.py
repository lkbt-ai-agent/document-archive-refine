"""검색·RAG 라우터 (search-backend §1).

단일 진입: 키워드/의미는 POST /search(결과 리스트), rag는 POST /search/ask(답변+인용).
"""

from fastapi import APIRouter

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
