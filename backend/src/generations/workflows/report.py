"""Report 워크플로우 — report_pipeline (ai-outputs.md §5, ai-outputs-backend §5).

추출 → 결정적 통계(Python) → Vega-Lite 스펙(LLM) → 스키마 검증·수리(≤5) → 서사(인용).
수치는 결정적 코드로 계산하고(LLM에 시키지 않음), 차트 데이터에 주입한다(ai-outputs.md §2).
"""

import json
from statistics import fmean
from uuid import UUID

from pydantic import BaseModel, Field

from src.ai.provider import get_llm_client
from src.ai.schemas import DecodeParams
from src.ai.structured import generate_structured
from src.generations.repository import GenerationRepository
from src.generations.workflows.base import (
    ChartRecord,
    PromptRecord,
    Usage,
    WorkflowResult,
    cited_sources,
    number_context,
)

MAX_REPAIR = 5

_SYS_EXTRACT = "주어진 문서에서 수치 데이터 항목(이름과 값)을 추출해 JSON으로 출력하라."
_SYS_SPEC = (
    "너는 Vega-Lite 차트 설계자다. 주어진 데이터 항목을 막대그래프로 보여줄 Vega-Lite 스펙을 "
    "JSON으로만 출력하라. 반드시 mark와 encoding(x, y)을 포함한다. data는 비워둬도 된다."
)
_SYS_NARRATIVE = (
    "너는 한국어 보고서 작성기다. 아래 컨텍스트와 계산된 통계에만 근거해 본문 서사를 작성하고 "
    "모든 수치 주장은 통계값을 참조하며 문장 끝마다 근거 [n]을 단다."
)


class Row(BaseModel):
    label: str = Field(description="항목 이름")
    value: float = Field(description="수치 값")


class Extraction(BaseModel):
    rows: list[Row] = Field(description="수치 데이터 항목 목록")
    unit: str | None = Field(default=None, description="단위(있으면)")


def _stats(values: list[float]) -> dict:
    if not values:
        return {"count": 0}
    return {
        "count": len(values),
        "sum": sum(values),
        "mean": fmean(values),
        "min": min(values),
        "max": max(values),
    }


def _valid_spec(spec: dict) -> bool:
    enc = spec.get("encoding", {})
    return bool(spec.get("mark") and isinstance(enc, dict) and enc.get("x") and enc.get("y"))


def _fallback_spec() -> dict:
    return {
        "mark": "bar",
        "encoding": {
            "x": {"field": "label", "type": "nominal"},
            "y": {"field": "value", "type": "quantitative"},
        },
    }


async def run(repo: GenerationRepository, document_ids: list[UUID], options) -> WorkflowResult:
    llm = get_llm_client()
    usage = Usage()
    seed = options.seed if options else None
    prompts: list[PromptRecord] = []

    chunks = await repo.fetch_chunks(document_ids)
    if not chunks:
        return WorkflowResult(method="report_pipeline", output_text="보고할 자료가 없습니다.")

    context, mapping = number_context(chunks)

    # 1) 구조화 데이터 추출
    extraction, re_ = await generate_structured(
        llm, system=_SYS_EXTRACT, prompt=context, schema=Extraction,
        params=DecodeParams(temperature=0.1, max_tokens=512, seed=seed),
    )
    usage.add(re_)
    prompts.append(PromptRecord("extract", 0, _SYS_EXTRACT, context[:500], re_.text))
    data_rows = [{"label": r.label, "value": r.value} for r in extraction.rows]

    # 2) 결정적 통계 (Python)
    stats = _stats([r.value for r in extraction.rows])

    # 3) 차트 스펙 (LLM) + 4) 검증·수리 루프(≤5)
    chart = await _build_chart(llm, seed, data_rows, stats, usage, prompts)

    # 5) 렌더 + 서사(인용)
    stat_line = ", ".join(f"{k}={v}" for k, v in stats.items())
    narr_prompt = f"컨텍스트:\n{context}\n\n계산된 통계: {stat_line}\n\n위를 설명하는 보고서 본문을 작성하라."
    rn = await llm.generate(
        system=_SYS_NARRATIVE, prompt=narr_prompt,
        params=DecodeParams(temperature=0.3, max_tokens=1024, seed=seed),
    )
    usage.add(rn)
    prompts.append(PromptRecord("narrative", MAX_REPAIR + 2, _SYS_NARRATIVE, narr_prompt[:500], rn.text))

    output = rn.text.strip()
    return WorkflowResult(
        method="report_pipeline",
        output_text=output,
        source_chunks=cited_sources(rn.text, mapping, step="narrative"),
        prompts=prompts,
        charts=[chart],
        usage=usage,
    )


async def _build_chart(llm, seed, data_rows, stats, usage, prompts) -> ChartRecord:
    spec: dict = {}
    attempts = 0
    while attempts < MAX_REPAIR:
        instruction = "데이터 항목: " + json.dumps(data_rows, ensure_ascii=False)
        if attempts > 0:
            instruction += "\n이전 스펙이 유효하지 않았다. mark와 encoding.x/y를 반드시 포함하라."
        r = await llm.generate(
            system=_SYS_SPEC, prompt=instruction,
            params=DecodeParams(temperature=0.1, max_tokens=400, seed=seed),
        )
        usage.add(r)
        prompts.append(PromptRecord("chart_spec", attempts + 1, _SYS_SPEC, instruction[:300], r.text))
        attempts += 1
        try:
            candidate = json.loads(r.text)
        except json.JSONDecodeError:
            continue
        if _valid_spec(candidate):
            spec = candidate
            break

    valid = bool(spec)
    if not valid:
        spec = _fallback_spec()  # 수리 실패 시 결정적 폴백(차트 유지)
    # 수치는 결정적으로 주입(LLM이 만든 데이터 사용 안 함)
    spec["data"] = {"values": data_rows}
    return ChartRecord(
        title="데이터 요약", spec=spec, data_rows=data_rows,
        computed_stats=stats, valid=valid, repair_attempts=attempts - 1 if valid else attempts,
    )
