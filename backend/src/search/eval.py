"""검색 평가 지표 (search-backend §6, search-and-rag §7).

키워드·의미 검색의 Recall@k와 RAG 답변의 인용 존재 이진 체크를 계산한다.
골든셋 기반 게이트는 tests/test_search_eval.py에서 결정적으로 돌린다(CI).
"""

from collections.abc import Iterable, Sequence
from uuid import UUID

from src.search.schemas import AskResponse, SearchResultItem


def recall_at_k(results: Sequence[SearchResultItem], relevant: Iterable[UUID], k: int) -> float:
    """상위 k개 '문서'(중복 제거) 중 정답 문서 비율."""
    relevant_set = set(relevant)
    if not relevant_set:
        return 0.0
    top_docs: list[UUID] = []
    seen: set[UUID] = set()
    for item in results:
        if item.document_id not in seen:
            seen.add(item.document_id)
            top_docs.append(item.document_id)
        if len(top_docs) >= k:
            break
    hits = len(set(top_docs) & relevant_set)
    return hits / len(relevant_set)


def citation_present(answer: AskResponse) -> bool:
    """RAG 답변에 인용이 하나라도 있는지 (이진 체크)."""
    return len(answer.citations) > 0
