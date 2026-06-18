"""Summary 워크플로우 (ai-outputs.md §3, ai-outputs-backend §3).

길이 분기: doc_tokens ≤ 0.6*ctx → STUFF, 초과 → MAP-REDUCE, ~50청크 초과 → HIERARCHICAL.
청크 미니요약 + 최종요약을 거치며 인용 [n]을 단다.
"""

from uuid import UUID

from src.ai.provider import get_llm_client
from src.ai.schemas import DecodeParams
from src.generations.repository import GenerationRepository
from src.generations.workflows.base import (
    PromptRecord,
    SourceChunk,
    Usage,
    WorkflowResult,
    cited_sources,
    number_context,
)
from src.ingestion.tokenizer import count_tokens

CTX = 8192
STUFF_LIMIT = int(0.6 * CTX)
HIER_CHUNKS = 50
HIER_GROUP = 20

_SYS_STUFF = "너는 한국어 요약기다. 문서를 간결히 요약하고 핵심 문장 끝마다 근거 [n]을 단다."
_SYS_MAP = "다음 청크를 한국어 2~3문장으로 요약하라."
_SYS_REDUCE = "다음 부분 요약들을 하나의 한국어 요약으로 통합하고 문장 끝마다 근거 [n]을 단다."


async def run(repo: GenerationRepository, document_ids: list[UUID], options) -> WorkflowResult:
    llm = get_llm_client()
    usage = Usage()
    max_tokens = (options.max_tokens if options else None) or 1024
    params = DecodeParams(temperature=0.3, max_tokens=max_tokens, seed=options.seed if options else None)

    chunks = await repo.fetch_chunks(document_ids)
    if not chunks:
        return WorkflowResult(method="stuff", output_text="요약할 내용이 없습니다.")

    total = await count_tokens("\n".join(c["content"] for c in chunks))

    if len(chunks) > HIER_CHUNKS:
        return await _hierarchical(llm, params, chunks, usage)
    if total > STUFF_LIMIT:
        return await _map_reduce(llm, params, chunks, usage)
    return await _stuff(llm, params, chunks, usage)


async def _stuff(llm, params, chunks, usage) -> WorkflowResult:
    context, mapping = number_context(chunks)
    prompt = f"{context}\n\n위 문서를 요약하라."
    r = await llm.generate(system=_SYS_STUFF, prompt=prompt, params=params)
    usage.add(r)
    return WorkflowResult(
        method="stuff",
        output_text=r.text.strip(),
        source_chunks=cited_sources(r.text, mapping, step="stuff"),
        prompts=[PromptRecord("stuff", 0, _SYS_STUFF, prompt, r.text)],
        usage=usage,
    )


async def _mini_summaries(llm, params, chunks, usage) -> tuple[list[str], list[PromptRecord]]:
    minis, prompts = [], []
    map_params = DecodeParams(temperature=0.2, max_tokens=256, seed=params.seed)
    for i, c in enumerate(chunks):
        r = await llm.generate(system=_SYS_MAP, prompt=c["content"], params=map_params)
        usage.add(r)
        minis.append(r.text.strip())
        prompts.append(PromptRecord("map", i, _SYS_MAP, c["content"][:500], r.text))
    return minis, prompts


async def _map_reduce(llm, params, chunks, usage) -> WorkflowResult:
    minis, prompts = await _mini_summaries(llm, params, chunks, usage)
    mapping = {i + 1: chunks[i] for i in range(len(chunks))}
    numbered = "\n\n".join(f"[{i + 1}] {m}" for i, m in enumerate(minis))
    prompt = f"부분 요약:\n{numbered}\n\n위를 통합 요약하라."
    r = await llm.generate(system=_SYS_REDUCE, prompt=prompt, params=params)
    usage.add(r)
    prompts.append(PromptRecord("reduce", len(chunks), _SYS_REDUCE, prompt, r.text))
    return WorkflowResult(
        method="map_reduce",
        output_text=r.text.strip(),
        source_chunks=cited_sources(r.text, mapping, step="reduce"),
        prompts=prompts,
        usage=usage,
    )


async def _hierarchical(llm, params, chunks, usage) -> WorkflowResult:
    groups = [chunks[i : i + HIER_GROUP] for i in range(0, len(chunks), HIER_GROUP)]
    group_summaries, prompts = [], []
    gp = DecodeParams(temperature=0.2, max_tokens=400, seed=params.seed)
    for gi, group in enumerate(groups):
        ctx = "\n\n".join(c["content"] for c in group)
        r = await llm.generate(system=_SYS_MAP, prompt=ctx, params=gp)
        usage.add(r)
        group_summaries.append(r.text.strip())
        prompts.append(PromptRecord("group", gi, _SYS_MAP, ctx[:500], r.text))
    numbered = "\n\n".join(f"[{i + 1}] {s}" for i, s in enumerate(group_summaries))
    prompt = f"섹션 요약:\n{numbered}\n\n위를 통합 요약하라."
    r = await llm.generate(system=_SYS_REDUCE, prompt=prompt, params=params)
    usage.add(r)
    prompts.append(PromptRecord("reduce", len(groups), _SYS_REDUCE, prompt, r.text))
    # 계보: 입력 청크 전체를 순번 출처로 기록(그룹 단위라 [n]↔청크 정밀 매핑은 생략)
    sources = [
        SourceChunk(
            chunk_id=c["chunk_id"],
            document_id=c["document_id"],
            citation_index=i + 1,
            cited_text=c["content"],
            cited_title=c.get("llm_title") or c.get("original_filename"),
            used_in_step="hierarchical",
        )
        for i, c in enumerate(chunks)
    ]
    return WorkflowResult(
        method="hierarchical",
        output_text=r.text.strip(),
        source_chunks=sources,
        prompts=prompts,
        usage=usage,
    )
