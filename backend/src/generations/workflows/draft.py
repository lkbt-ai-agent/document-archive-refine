"""Draft 워크플로우 — outline_expand (ai-outputs.md §4, ai-outputs-backend §4).

1) 요약/본문으로 개요 제안(자동 확정) 2) 섹션별 관련 청크 검색·생성(인용) 3) 조립.
인용 [n]은 문서 전체에서 유일하도록 전역 번호를 매긴다.
"""

from uuid import UUID

from pydantic import BaseModel, Field

from src.ai.provider import get_embedding_client, get_llm_client
from src.ai.schemas import DecodeParams
from src.ai.structured import generate_structured
from src.generations.repository import GenerationRepository
from src.generations.workflows.base import (
    PromptRecord,
    Usage,
    WorkflowResult,
    cited_sources,
)

_SYS_OUTLINE = "너는 한국어 문서 작성기다. 주어진 자료로 보고서 개요(섹션 제목 3~6개)를 JSON으로 제안하라."
_SYS_SECTION = (
    "너는 한국어 문서 작성기다. 아래 컨텍스트에만 근거해 해당 섹션 본문을 작성하고 "
    "문장 끝마다 근거 [n]을 단다."
)


class Outline(BaseModel):
    sections: list[str] = Field(description="섹션 제목 목록")


async def run(repo: GenerationRepository, document_ids: list[UUID], options) -> WorkflowResult:
    llm = get_llm_client()
    emb = get_embedding_client()
    usage = Usage()
    seed = options.seed if options else None
    k = (options.k if options else None) or 5

    chunks = await repo.fetch_chunks(document_ids)
    if not chunks:
        return WorkflowResult(method="outline_expand", output_text="작성할 자료가 없습니다.")

    brief = "\n".join(c["content"] for c in chunks)[:4000]
    outline, r0 = await generate_structured(
        llm, system=_SYS_OUTLINE, prompt=f"자료:\n{brief}", schema=Outline,
        params=DecodeParams(temperature=0.3, max_tokens=256, seed=seed),
    )
    usage.add(r0)
    prompts = [PromptRecord("outline", 0, _SYS_OUTLINE, brief[:500], r0.text)]

    body_parts: list[str] = []
    all_sources = []
    counter = 0
    sec_params = DecodeParams(temperature=0.4, max_tokens=700, seed=seed)
    for si, title in enumerate(outline.sections, start=1):
        qv = (await emb.embed([title]))[0]
        hits = await repo.semantic_in_docs(document_ids, qv, k)
        # 전역 인용 번호 매핑
        mapping = {}
        block_lines = []
        for h in hits:
            counter += 1
            mapping[counter] = h
            block_lines.append(f"[{counter}] {h['content']}")
        context = "\n\n".join(block_lines)
        prompt = f"섹션 제목: {title}\n\n컨텍스트:\n{context}\n\n이 섹션 본문을 작성하라."
        r = await llm.generate(system=_SYS_SECTION, prompt=prompt, params=sec_params)
        usage.add(r)
        body_parts.append(f"## {title}\n\n{r.text.strip()}")
        all_sources.extend(cited_sources(r.text, mapping, step=f"section:{title}"))
        prompts.append(PromptRecord(f"section:{title}", si, _SYS_SECTION, prompt[:500], r.text))

    output = "\n\n".join(body_parts)
    return WorkflowResult(
        method="outline_expand",
        output_text=output,
        source_chunks=all_sources,
        prompts=prompts,
        usage=usage,
    )
