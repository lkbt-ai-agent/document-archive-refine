"""생성·계보 서비스 (ai-outputs-backend §1·§2).

비동기 생성 접수(202), 상태·결과 조회, 계보 조회, 산출물 내역 조회. owner 스코프 강제.
"""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.common.exceptions import NotFoundError
from src.documents.exceptions import DocumentNotFound
from src.documents.repository import DocumentRepository
from src.generations.repository import GenerationRepository
from src.generations.schemas import (
    ArtifactListItem,
    GenerationCreate,
    GenerationRead,
    LineageResponse,
    PromptRead,
    SourceChunkRead,
    SourceDocumentRead,
    ChartRead,
)
from src.pipeline.queue import enqueue

GENERATE_TASK = "run_generation"


class GenerationService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = GenerationRepository(session)
        self.docs = DocumentRepository(session)

    async def create(self, owner_id: UUID, data: GenerationCreate) -> GenerationRead:
        # 입력 문서 소유 검증
        for did in data.document_ids:
            if await self.docs.get(owner_id, did) is None:
                raise DocumentNotFound()
        gen = await self.repo.create_head(
            owner_id, data.kind.value, data.document_ids, data.options.model_dump()
        )
        await self.session.commit()
        await enqueue(GENERATE_TASK, str(gen.id), _job_id=f"generate:{gen.id}")
        await self.session.refresh(gen)
        return GenerationRead.model_validate(gen)

    async def get(self, owner_id: UUID, generation_id: UUID) -> GenerationRead:
        gen = await self.repo.get(generation_id, owner_id)
        if gen is None:
            raise NotFoundError("생성을 찾을 수 없습니다.", code="generation_not_found")
        return GenerationRead.model_validate(gen)

    async def lineage(self, owner_id: UUID, generation_id: UUID) -> LineageResponse:
        gen = await self.repo.get(generation_id, owner_id)
        if gen is None:
            raise NotFoundError("생성을 찾을 수 없습니다.", code="generation_not_found")
        rows = await self.repo.lineage_rows(generation_id)
        return LineageResponse(
            generation=GenerationRead.model_validate(gen),
            source_documents=[SourceDocumentRead.model_validate(r) for r in rows["source_documents"]],
            source_chunks=[SourceChunkRead.model_validate(r) for r in rows["source_chunks"]],
            prompts=[PromptRead.model_validate(r) for r in rows["prompts"]],
            charts=[ChartRead.model_validate(r) for r in rows["charts"]],
        )

    async def list_artifacts(
        self, owner_id: UUID, source_document_id: UUID | None, kind: str | None
    ) -> list[ArtifactListItem]:
        rows = await self.repo.list_artifacts(owner_id, source_document_id, kind)
        return [ArtifactListItem.model_validate(r) for r in rows]
