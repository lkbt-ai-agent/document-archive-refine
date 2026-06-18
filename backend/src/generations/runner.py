"""생성 실행 오케스트레이션 (ai-outputs-backend §2·§6·§7).

worker가 호출한다: running 전이 → 워크플로우 실행 → 계보 스냅샷 기록 → 산출물 문서화 →
succeeded/failed 종료. 멱등 키는 generation_id.
"""

import logging
import time
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import text

from src.database import async_session
from src.generations.materialize import compose_markdown, materialize
from src.generations.repository import GenerationRepository
from src.generations.workflows import draft, report, summary
from src.generations.workflows.base import WorkflowOptions, WorkflowResult
from src.documents.models import Document

logger = logging.getLogger("mechive.generation")

_WORKFLOWS = {"summary": summary.run, "draft": draft.run, "report": report.run}


async def _chat_model_id(session) -> int | None:
    return await session.scalar(text("SELECT id FROM archive.models WHERE name = 'A.X-4.0-Light'"))


async def _primary_folder(session, doc_ids: list[UUID]) -> UUID | None:
    if not doc_ids:
        return None
    doc = await session.get(Document, doc_ids[0])
    return doc.folder_id if doc else None


def _title_hint(result: WorkflowResult) -> str | None:
    for line in result.output_text.splitlines():
        s = line.lstrip("# ").strip()
        if s:
            return s[:60]
    return None


async def run(generation_id: str) -> None:
    gen_uuid = UUID(generation_id)
    start = time.monotonic()
    async with async_session() as session:
        repo = GenerationRepository(session)
        gen = await repo.get(gen_uuid)
        if gen is None:
            logger.warning("generation 없음 %s", generation_id)
            return
        try:
            gen.status, gen.started_at, gen.provider, gen.progress_pct = (
                "running", datetime.now(UTC), "llama", 10
            )
            await session.commit()

            doc_ids = await repo.input_document_ids(gen_uuid)
            options = WorkflowOptions(
                max_tokens=gen.max_tokens, seed=gen.seed, k=gen.retrieval_k,
                temperature=gen.temperature,
            )
            workflow = _WORKFLOWS.get(gen.kind)
            if workflow is None:
                raise ValueError(f"지원하지 않는 산출물 종류: {gen.kind}")
            result = await workflow(repo, doc_ids, options)

            model_id = await _chat_model_id(session)
            await repo.record_result(gen, result, model_id)
            gen.progress_pct, gen.progress_step = 70, "materializing"
            await session.commit()

            # 산출물 문서화 (H6)
            folder_id = await _primary_folder(session, doc_ids)
            markdown = compose_markdown(result.output_text, result.charts)
            out_id = await materialize(
                session, owner_id=gen.user_id, kind=gen.kind, markdown=markdown,
                folder_id=folder_id, title_hint=_title_hint(result),
            )
            gen.output_document_id = out_id
            gen.status, gen.progress_pct, gen.progress_step = "succeeded", 100, "done"
            gen.finished_at = datetime.now(UTC)
            gen.latency_ms = int((time.monotonic() - start) * 1000)
            await session.commit()
            logger.info("generation 완료 %s: kind=%s out=%s", generation_id, gen.kind, out_id)
        except Exception as exc:
            await session.rollback()
            failed = await repo.get(gen_uuid)
            if failed is not None:
                failed.status, failed.error = "failed", str(exc)[:2000]
                failed.finished_at = datetime.now(UTC)
                await session.commit()
            logger.exception("generation 실패 %s: %s", generation_id, exc)
            raise
