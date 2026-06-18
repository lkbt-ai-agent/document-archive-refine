"""생성·계보 리포지토리 (ai-outputs-backend §6, generations-schema §1·§2).

계보 헤드 생성, 입력 출처 기록, 청크 접근(워크플로우용), 계보 스냅샷 기록, 산출물 내역 조회.
"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.documents.models import Document, DocumentChunk
from src.generations.models import (
    Generation,
    GenerationChart,
    GenerationPrompt,
    GenerationSourceChunk,
    GenerationSourceDocument,
)


class GenerationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # --- 생성/조회 ---
    async def create_head(
        self, owner_id: UUID, kind: str, document_ids: list[UUID], options: dict | None = None
    ) -> Generation:
        opts = options or {}
        gen = Generation(
            kind=kind,
            status="queued",
            user_id=owner_id,
            seed=opts.get("seed"),
            max_tokens=opts.get("max_tokens"),
            temperature=opts.get("temperature"),
            retrieval_k=opts.get("k"),
        )
        self.session.add(gen)
        await self.session.flush()
        # 입력 출처 기록(role='input') + 제목 스냅샷
        for did in document_ids:
            doc = await self.session.get(Document, did)
            title = (doc.llm_title or doc.original_filename) if doc else None
            self.session.add(
                GenerationSourceDocument(
                    generation_id=gen.id, document_id=did, role="input", cited_title=title
                )
            )
        await self.session.flush()
        return gen

    async def get(self, generation_id: UUID, owner_id: UUID | None = None) -> Generation | None:
        stmt = select(Generation).where(Generation.id == generation_id)
        if owner_id is not None:
            stmt = stmt.where(Generation.user_id == owner_id)
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def input_document_ids(self, generation_id: UUID) -> list[UUID]:
        rows = (
            await self.session.execute(
                select(GenerationSourceDocument.document_id).where(
                    GenerationSourceDocument.generation_id == generation_id,
                    GenerationSourceDocument.role == "input",
                )
            )
        ).scalars()
        return [r for r in rows if r is not None]

    # --- 워크플로우용 청크 접근 ---
    async def fetch_chunks(self, document_ids: list[UUID]) -> list[dict]:
        stmt = (
            select(
                DocumentChunk.id.label("chunk_id"),
                DocumentChunk.document_id,
                DocumentChunk.chunk_index,
                DocumentChunk.content,
                Document.llm_title,
                Document.original_filename,
            )
            .join(Document, Document.id == DocumentChunk.document_id)
            .where(DocumentChunk.document_id.in_(document_ids))
            .order_by(DocumentChunk.document_id, DocumentChunk.chunk_index)
        )
        return [dict(r) for r in (await self.session.execute(stmt)).mappings().all()]

    async def semantic_in_docs(
        self, document_ids: list[UUID], query_vector: list[float], k: int
    ) -> list[dict]:
        distance = DocumentChunk.embedding.cosine_distance(query_vector).label("distance")
        stmt = (
            select(
                DocumentChunk.id.label("chunk_id"),
                DocumentChunk.document_id,
                DocumentChunk.content,
                Document.llm_title,
                Document.original_filename,
                distance,
            )
            .join(Document, Document.id == DocumentChunk.document_id)
            .where(DocumentChunk.document_id.in_(document_ids))
            .order_by(distance)
            .limit(k)
        )
        return [dict(r) for r in (await self.session.execute(stmt)).mappings().all()]

    # --- 산출물 내역 / 계보 ---
    async def list_artifacts(
        self,
        owner_id: UUID,
        source_document_id: UUID | None = None,
        kind: str | None = None,
    ) -> list[Generation]:
        stmt = select(Generation).where(
            Generation.user_id == owner_id, Generation.output_document_id.is_not(None)
        )
        if kind is not None:
            stmt = stmt.where(Generation.kind == kind)
        if source_document_id is not None:
            stmt = stmt.join(
                GenerationSourceDocument,
                GenerationSourceDocument.generation_id == Generation.id,
            ).where(GenerationSourceDocument.document_id == source_document_id)
        stmt = stmt.order_by(Generation.created_at.desc())
        return list((await self.session.execute(stmt)).scalars().unique().all())

    async def record_result(self, generation: Generation, result, model_id: int | None) -> None:
        """워크플로우 결과를 계보로 스냅샷 기록 (generations-schema §2)."""
        generation.method = result.method
        generation.output_text = result.output_text
        generation.output_meta = {"chart_count": len(result.charts)}
        generation.provider = "llama"
        generation.model_id = model_id
        generation.prompt_tokens = result.usage.prompt_tokens
        generation.completion_tokens = result.usage.completion_tokens
        generation.total_tokens = result.usage.total_tokens

        for p in result.prompts:
            self.session.add(
                GenerationPrompt(
                    generation_id=generation.id, step=p.step, step_index=p.step_index,
                    rendered_system=p.system, rendered_prompt=p.prompt, raw_response=p.response,
                )
            )
        for s in result.source_chunks:
            self.session.add(
                GenerationSourceChunk(
                    generation_id=generation.id, chunk_id=s.chunk_id, document_id=s.document_id,
                    citation_index=s.citation_index, similarity=s.similarity,
                    used_in_step=s.used_in_step, cited_text=s.cited_text, cited_title=s.cited_title,
                )
            )
        for ch in result.charts:
            self.session.add(
                GenerationChart(
                    generation_id=generation.id, title=ch.title, spec=ch.spec,
                    data_rows=ch.data_rows, computed_stats=ch.computed_stats,
                    valid=ch.valid, repair_attempts=ch.repair_attempts,
                )
            )
        await self.session.flush()

    async def lineage_rows(self, generation_id: UUID) -> dict:
        async def fetch(model, order=None):
            stmt = select(model).where(model.generation_id == generation_id)
            if order is not None:
                stmt = stmt.order_by(order)
            return list((await self.session.execute(stmt)).scalars().all())

        return {
            "source_documents": await fetch(GenerationSourceDocument),
            "source_chunks": await fetch(
                GenerationSourceChunk, GenerationSourceChunk.citation_index
            ),
            "prompts": await fetch(GenerationPrompt, GenerationPrompt.step_index),
            "charts": await fetch(GenerationChart),
        }
