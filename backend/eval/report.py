"""결과 리포트 (research 03-search-eval-testset/01 §6).

JSON을 정본으로 쌓고 Markdown을 JSON에서 생성한다. run 아티팩트는 runs/<run_id>/에 둔다.
run_id, git sha, config, aggregate, per-case를 담고, ablation 조건을 조건별 표로 보인다.
"""

import json
import subprocess
from datetime import UTC, datetime
from pathlib import Path

from eval import metrics
from eval.runner import RunResult

RUNS_DIR = Path(__file__).parent / "runs"


def _git_sha() -> str:
    try:
        return subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            capture_output=True, text=True, check=True,
        ).stdout.strip()
    except Exception:  # noqa: BLE001
        return "nogit"


def _table(rows: list[tuple[str, str]], head: tuple[str, str]) -> list[str]:
    out = [f"| {head[0]} | {head[1]} |", "| --- | --- |"]
    out += [f"| {a} | {b} |" for a, b in rows]
    return out


def _fmt(v) -> str:
    if v is None:
        return "n/a"
    if isinstance(v, float):
        return f"{v:.3f}"
    return str(v)


def _aggregate_rows(agg: dict) -> list[tuple[str, str]]:
    keys = ["n_cases", "n_error", "pass_rate", "recall_at_5", "recall_at_20",
            "mean_rank", "retrieval_found", "mean_coverage_at_20",
            "citation_rate", "citation_correct_rate", "rejection_rate"]
    return [(k, _fmt(agg[k])) for k in keys]


def _markdown(run_id: str, git_sha: str, created_at: str,
              runs: list[tuple[dict, dict]]) -> str:
    """runs: (config, aggregate) 목록. 첫 항목이 baseline."""
    base_cfg, base_agg = runs[0]
    lines = [f"# 검색 평가 리포트 {run_id}", "",
             f"- git sha: {git_sha}", f"- 생성: {created_at}",
             f"- baseline config: {json.dumps(base_cfg, ensure_ascii=False)}", ""]

    lines += ["## 집계 (baseline)", ""]
    lines += _table(_aggregate_rows(base_agg), ("지표", "값"))

    lines += ["", "## 모드별 통과율", ""]
    lines += _table([(m, _fmt(v)) for m, v in base_agg["by_mode"].items()], ("모드", "통과율"))

    lines += ["", "## 실패 유형별 통과율", ""]
    lines += _table([(fm, _fmt(v)) for fm, v in base_agg["by_failure_mode"].items()],
                    ("실패 유형", "통과율"))

    if len(runs) > 1:
        lines += ["", "## ablation 비교", ""]
        head = "| config | pass_rate | recall@5 | recall@20 | citation | citation_ok | rejection |"
        sep = "| --- | --- | --- | --- | --- | --- | --- |"
        lines += [head, sep]
        for cfg, agg in runs:
            lines.append(
                f"| {cfg['name']} | {_fmt(agg['pass_rate'])} | {_fmt(agg['recall_at_5'])} | "
                f"{_fmt(agg['recall_at_20'])} | {_fmt(agg['citation_rate'])} | "
                f"{_fmt(agg['citation_correct_rate'])} | {_fmt(agg['rejection_rate'])} |")

    return "\n".join(lines) + "\n"


def _fail_rows(cases: list[dict]) -> list[str]:
    fails = [c for c in cases if c["status"] != "pass"]
    if not fails:
        return ["", "## 실패 케이스", "", "없음."]
    lines = ["", f"## 실패 케이스 ({len(fails)})", "",
             "| id | mode | 유형 | 상태 | 순위 | 인용 | 거부 | note |",
             "| --- | --- | --- | --- | --- | --- | --- | --- |"]
    for c in fails:
        lines.append(
            f"| {c['id']} | {c['mode']} | {','.join(c['failure_modes'])} | {c['status']} | "
            f"{_fmt(c['answer_rank'])} | {_fmt(c['citation_correct'])} | "
            f"{_fmt(c['rejected'])} | {c.get('note', '')} |")
    return lines


def write_run(results: list[RunResult]) -> Path:
    """ablation 조건별 RunResult를 받아 아티팩트를 쓴다. 첫 항목이 baseline이다."""
    git_sha = _git_sha()
    now = datetime.now(UTC)
    run_id = f"{now:%Y%m%dT%H%M%S}-{git_sha}"
    created_at = now.isoformat()

    run_dir = RUNS_DIR / run_id
    run_dir.mkdir(parents=True, exist_ok=True)

    cfg_aggs: list[tuple[dict, dict]] = []
    for r in results:
        agg = metrics.aggregate(r.cases)
        cfg_aggs.append((r.config, agg))
        payload = {"run_id": run_id, "git_sha": git_sha, "created_at": created_at,
                   "config": r.config, "aggregate": agg, "cases": r.cases}
        (run_dir / f"{r.config['name']}.json").write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    md = _markdown(run_id, git_sha, created_at, cfg_aggs)
    md += "\n".join(_fail_rows(results[0].cases)) + "\n"
    (run_dir / "report.md").write_text(md, encoding="utf-8")
    return run_dir
