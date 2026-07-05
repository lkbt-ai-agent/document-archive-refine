"""검색 평가 워크플로우 CLI (research 03-search-eval-testset/01 §5.6).

서브커맨드는 load(적재), run(실행), diff(회귀 비교)다. 적재의 인제스트 단계와
실행·회귀는 후속 작업에서 채운다. 지금 load는 픽스처를 읽어 검증한다.
"""

import argparse
import asyncio
import sys


def _cmd_load(args: argparse.Namespace) -> int:
    """코퍼스·케이스를 적재한다(01 §3)."""
    from eval import loader

    return asyncio.run(
        loader.run(reingest=args.reingest, dry_run=args.dry_run, limit=args.limit)
    )


def _cmd_run(args: argparse.Namespace) -> int:
    """전체 케이스를 실행하고 JSON 정본과 Markdown 리포트를 쓴다(01 §4·§6)."""
    from eval import report, runner

    configs = runner.ABLATIONS if args.ablation else [runner.BASELINE]
    results = asyncio.run(runner.run_configs(configs))
    run_dir = report.write_run(results)

    base = results[0]
    agg = report.metrics.aggregate(base.cases)
    print(f"\nrun 아티팩트: {run_dir}")
    print(f"통과율 {agg['pass_rate']} | recall@5 {agg['recall_at_5']} | "
          f"recall@20 {agg['recall_at_20']} | 인용율 {agg['citation_rate']} | "
          f"인용정확 {agg['citation_correct_rate']} | 거부율 {agg['rejection_rate']}")
    if agg["n_error"]:
        print(f"경고: error 케이스 {agg['n_error']}건")
    return 0


def _cmd_diff(args: argparse.Namespace) -> int:
    raise SystemExit("diff: 미구현 (재테스트·회귀 비교, 01 §7)")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="eval", description="검색 평가 워크플로우")
    sub = parser.add_subparsers(dest="command", required=True)

    p_load = sub.add_parser("load", help="코퍼스·케이스 적재")
    p_load.add_argument("--reingest", action="store_true", help="파이프라인 수정 후 강제 재적재")
    p_load.add_argument("--dry-run", action="store_true", help="적재 없이 검증·계획만 출력")
    p_load.add_argument("--limit", type=int, default=None, help="신규 적재를 N건으로 제한(스모크)")
    p_load.set_defaults(func=_cmd_load)

    p_run = sub.add_parser("run", help="전체 케이스 실행")
    p_run.add_argument("--ablation", action="store_true",
                       help="제목 매칭·쿼리 재작성 토글별로 반복 실행(01 §4.2)")
    p_run.set_defaults(func=_cmd_run)

    p_diff = sub.add_parser("diff", help="두 run 회귀 비교")
    p_diff.add_argument("base")
    p_diff.add_argument("new")
    p_diff.set_defaults(func=_cmd_diff)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
