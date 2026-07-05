"""케이스 실행 (research 03-search-eval-testset/01 §4).

모드별로 검색을 in-process로 호출해 케이스마다 정답 순위, Recall@5/@20 hit, rag 인용 존재·정확,
부정 케이스 거부를 기록한다. ablation은 config 토글(제목 매칭, 쿼리 재작성)로 조건을 바꾼다.
rag 생성은 온도 0으로 고정해 결정적으로 돌린다(01 §5.3).
"""

from dataclasses import asdict, dataclass, field

from eval import loader, schemas
from eval.context import EVAL_OWNER_ID, build_search_service, eval_session
from src.search.schemas import AskRequest, SearchRequest

# 문서 단위 순위를 20위까지 세려면 청크를 넉넉히 받아 dedupe한다.
RETRIEVAL_CHUNK_LIMIT = 100
RAG_K = 8


@dataclass(frozen=True)
class AblationConfig:
    """ablation 한 조건. 토글 기본값은 운영 동작과 같다(01 §5.4)."""

    name: str
    query_rewrite: bool = True
    title_match: bool = True


BASELINE = AblationConfig("baseline")
ABLATIONS = [
    BASELINE,
    AblationConfig("no_rewrite", query_rewrite=False),
    AblationConfig("no_title_match", title_match=False),
]


@dataclass
class CaseResult:
    id: str
    mode: str
    persona: str
    failure_modes: list[str]
    difficulty: str
    expected_reject: bool
    answer_count: int
    status: str  # pass | fail | error
    answer_rank: int | None = None
    hit_at_5: bool | None = None
    hit_at_20: bool | None = None
    coverage_at_20: float | None = None
    citation_present: bool | None = None
    citation_correct: bool | None = None
    rejected: bool | None = None
    note: str = ""


@dataclass
class RunResult:
    config: dict
    cases: list[dict] = field(default_factory=list)


def _dedupe_docs(document_ids: list[str]) -> list[str]:
    """청크 순서를 문서 순서로 접는다(문서별 최상위 청크 위치 유지)."""
    seen: set[str] = set()
    order: list[str] = []
    for d in document_ids:
        if d not in seen:
            seen.add(d)
            order.append(d)
    return order


def _resolve_answers(case: schemas.Case, mapping: dict[str, str]) -> set[str] | None:
    """케이스 정답 sha를 document_id 집합으로 해소한다. 못 찾으면 None(error)."""
    out: set[str] = set()
    for did in case.answer_doc_ids:
        sha = did.rsplit(":", 1)[1]
        doc_id = mapping.get(sha)
        if doc_id is None:
            return None
        out.add(doc_id)
    return out


async def _run_retrieval(service, case: schemas.Case, answers: set[str]) -> CaseResult:
    req = SearchRequest(q=case.question, mode=case.mode, limit=RETRIEVAL_CHUNK_LIMIT)
    resp = await service.search(EVAL_OWNER_ID, req)
    order = _dedupe_docs([str(r.document_id) for r in resp.results])
    ranks = [i + 1 for i, d in enumerate(order) if d in answers]
    answer_rank = min(ranks) if ranks else None
    found_20 = {d for d in order[:20] if d in answers}
    return CaseResult(
        id=case.id, mode=case.mode, persona=case.persona,
        failure_modes=list(case.failure_modes), difficulty=case.difficulty,
        expected_reject=False, answer_count=len(answers),
        answer_rank=answer_rank,
        hit_at_5=answer_rank is not None and answer_rank <= 5,
        hit_at_20=answer_rank is not None and answer_rank <= 20,
        coverage_at_20=len(found_20) / len(answers) if answers else None,
        status="pass" if (answer_rank is not None and answer_rank <= 5) else "fail",
    )


async def _run_rag(service, case: schemas.Case, answers: set[str], expect_reject: bool) -> CaseResult:
    resp = await service.ask(EVAL_OWNER_ID, AskRequest(q=case.question, k=RAG_K))
    cited = {str(c.document_id) for c in resp.citations}
    citation_present = len(cited) > 0
    rejected = (not citation_present) or ("찾을 수 없" in resp.answer)
    res = CaseResult(
        id=case.id, mode=case.mode, persona=case.persona,
        failure_modes=list(case.failure_modes), difficulty=case.difficulty,
        expected_reject=expect_reject, answer_count=len(answers),
        citation_present=citation_present, rejected=rejected, status="fail",
    )
    if expect_reject:
        res.status = "pass" if rejected else "fail"
        return res
    res.citation_correct = any(d in answers for d in cited)
    res.status = "pass" if (citation_present and res.citation_correct) else "fail"
    return res


async def _run_one(config: AblationConfig, cases: list[schemas.Case], mapping: dict[str, str]) -> RunResult:
    out = RunResult(config={"query_rewrite": config.query_rewrite,
                            "title_match": config.title_match, "name": config.name})
    async with eval_session() as session:
        service = build_search_service(
            session, query_rewrite=config.query_rewrite, title_match=config.title_match
        )
        for case in cases:
            answers = _resolve_answers(case, mapping)
            if answers is None:
                out.cases.append(asdict(CaseResult(
                    id=case.id, mode=case.mode, persona=case.persona,
                    failure_modes=list(case.failure_modes), difficulty=case.difficulty,
                    expected_reject=False, answer_count=0, status="error",
                    note="정답 sha를 매핑에서 못 찾음")))
                continue
            expect_reject = len(case.answer_doc_ids) == 0
            if case.mode == "rag":
                res = await _run_rag(service, case, answers, expect_reject)
            else:
                res = await _run_retrieval(service, case, answers)
            out.cases.append(asdict(res))
    return out


async def run_configs(configs: list[AblationConfig]) -> list[RunResult]:
    """주어진 ablation 조건들을 순서대로 실행한다."""
    cases = schemas.read_cases()
    async with eval_session() as session:
        mapping = await loader.build_mapping(session)
    results: list[RunResult] = []
    for cfg in configs:
        print(f"  실행: config={cfg.name} "
              f"(query_rewrite={cfg.query_rewrite}, title_match={cfg.title_match})")
        results.append(await _run_one(cfg, cases, mapping))
    return results
