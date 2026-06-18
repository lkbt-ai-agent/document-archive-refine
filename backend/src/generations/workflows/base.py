"""워크플로우 공통 타입·헬퍼 (ai-outputs-backend §3·§4·§5·§6).

워크플로우는 산출물 텍스트와 계보(출처 청크·프롬프트·차트)를 WorkflowResult로 반환하고,
worker가 이를 스냅샷으로 기록한다. 인용은 번호↔청크 매핑으로 보존한다(ai-outputs.md §2).
"""

import re
from dataclasses import dataclass, field
from uuid import UUID

from src.ai.schemas import LLMResult

CITATION_RE = re.compile(r"\[(\d+)\]")


@dataclass(slots=True)
class WorkflowOptions:
    max_tokens: int | None = None
    seed: int | None = None
    k: int | None = None
    temperature: float | None = None


@dataclass(slots=True)
class SourceChunk:
    chunk_id: UUID
    document_id: UUID
    citation_index: int
    cited_text: str  # 인용 청크 본문 스냅샷
    cited_title: str | None
    similarity: float | None = None
    used_in_step: str | None = None


@dataclass(slots=True)
class PromptRecord:
    step: str
    step_index: int
    system: str
    prompt: str
    response: str | None = None


@dataclass(slots=True)
class ChartRecord:
    title: str
    spec: dict
    data_rows: list | dict | None
    computed_stats: dict | None
    valid: bool
    repair_attempts: int


@dataclass(slots=True)
class Usage:
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0

    def add(self, r: LLMResult) -> None:
        self.prompt_tokens += r.prompt_tokens or 0
        self.completion_tokens += r.completion_tokens or 0
        self.total_tokens += r.total_tokens or 0


@dataclass(slots=True)
class WorkflowResult:
    method: str
    output_text: str
    source_chunks: list[SourceChunk] = field(default_factory=list)
    prompts: list[PromptRecord] = field(default_factory=list)
    charts: list[ChartRecord] = field(default_factory=list)
    usage: Usage = field(default_factory=Usage)


def number_context(chunks: list[dict]) -> tuple[str, dict[int, dict]]:
    """청크를 [n]으로 번호 매겨 컨텍스트 문자열과 n→청크 매핑을 만든다."""
    blocks, mapping = [], {}
    for i, c in enumerate(chunks, start=1):
        mapping[i] = c
        title = c.get("llm_title") or c.get("original_filename")
        blocks.append(f"[{i}] (제목: {title})\n{c['content']}")
    return "\n\n".join(blocks), mapping


def cited_sources(answer: str, mapping: dict[int, dict], step: str | None = None) -> list[SourceChunk]:
    """답변에 등장한 [n]을 출처 청크 스냅샷으로 변환(원본 삭제에도 계보 유지)."""
    out = []
    for n in sorted({int(x) for x in CITATION_RE.findall(answer)}):
        c = mapping.get(n)
        if not c:
            continue
        out.append(
            SourceChunk(
                chunk_id=c["chunk_id"],
                document_id=c["document_id"],
                citation_index=n,
                cited_text=c["content"],
                cited_title=c.get("llm_title") or c.get("original_filename"),
                similarity=(1.0 - c["distance"]) if c.get("distance") is not None else None,
                used_in_step=step,
            )
        )
    return out
