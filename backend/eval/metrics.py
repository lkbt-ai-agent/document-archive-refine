"""지표 집계 (research 03-search-eval-testset/01 §4.3, 방법론 00 §9).

전역 Recall@5/@20, 인용율, 인용 정확율, 거부율, 평균 순위와 실패 유형별 통과율을 집계한다.
Recall과 순위는 retrieval 모드(keyword·semantic), 인용은 rag positive, 거부는 rag negative에서 잰다.
"""

from collections import defaultdict


def _mean(xs: list[float]) -> float | None:
    return round(sum(xs) / len(xs), 4) if xs else None


def aggregate(cases: list[dict]) -> dict:
    """per-case 기록을 집계 지표로 접는다."""
    retrieval = [c for c in cases if c["mode"] in ("keyword", "semantic") and c["status"] != "error"]
    rag_pos = [c for c in cases if c["mode"] == "rag" and not c["expected_reject"] and c["status"] != "error"]
    rag_neg = [c for c in cases if c["mode"] == "rag" and c["expected_reject"] and c["status"] != "error"]
    ranks = [c["answer_rank"] for c in retrieval if c["answer_rank"] is not None]

    by_mode: dict[str, float | None] = {}
    for m in ("keyword", "semantic", "rag"):
        ms = [c for c in cases if c["mode"] == m and c["status"] != "error"]
        by_mode[m] = _mean([1.0 if c["status"] == "pass" else 0.0 for c in ms])

    by_fm: dict[str, float | None] = {}
    buckets: dict[str, list[float]] = defaultdict(list)
    for c in cases:
        if c["status"] == "error":
            continue
        for fm in c["failure_modes"]:
            buckets[fm].append(1.0 if c["status"] == "pass" else 0.0)
    for fm in sorted(buckets):
        by_fm[fm] = _mean(buckets[fm])

    return {
        "n_cases": len(cases),
        "n_error": sum(1 for c in cases if c["status"] == "error"),
        "pass_rate": _mean([1.0 if c["status"] == "pass" else 0.0
                            for c in cases if c["status"] != "error"]),
        "recall_at_5": _mean([1.0 if c["hit_at_5"] else 0.0 for c in retrieval]),
        "recall_at_20": _mean([1.0 if c["hit_at_20"] else 0.0 for c in retrieval]),
        "mean_rank": _mean([float(r) for r in ranks]),
        "retrieval_found": f"{len(ranks)}/{len(retrieval)}",
        "mean_coverage_at_20": _mean([c["coverage_at_20"] for c in retrieval
                                      if c["coverage_at_20"] is not None]),
        "citation_rate": _mean([1.0 if c["citation_present"] else 0.0 for c in rag_pos]),
        "citation_correct_rate": _mean([1.0 if c["citation_correct"] else 0.0 for c in rag_pos]),
        "rejection_rate": _mean([1.0 if c["rejected"] else 0.0 for c in rag_neg]),
        "by_mode": by_mode,
        "by_failure_mode": by_fm,
    }
