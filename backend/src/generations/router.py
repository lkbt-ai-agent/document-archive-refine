"""생성·계보 라우터 (ai-outputs-backend §1)."""

from uuid import UUID

from fastapi import APIRouter, Query, status

from src.common.deps import OwnerDep, SessionDep
from src.generations.enums import ArtifactKind
from src.generations.schemas import (
    ArtifactListItem,
    GenerationCreate,
    GenerationRead,
    LineageResponse,
)
from src.generations.service import GenerationService

router = APIRouter(prefix="/generations", tags=["generations"])


@router.post("", response_model=GenerationRead, status_code=status.HTTP_202_ACCEPTED)
async def create_generation(
    data: GenerationCreate, session: SessionDep, owner: OwnerDep
) -> GenerationRead:
    return await GenerationService(session).create(owner, data)


@router.get("", response_model=list[ArtifactListItem])
async def list_artifacts(
    session: SessionDep,
    owner: OwnerDep,
    source_document_id: UUID | None = Query(default=None),
    kind: ArtifactKind | None = Query(default=None),
) -> list[ArtifactListItem]:
    return await GenerationService(session).list_artifacts(
        owner, source_document_id, kind.value if kind else None
    )


@router.get("/{generation_id}", response_model=GenerationRead)
async def get_generation(
    generation_id: UUID, session: SessionDep, owner: OwnerDep
) -> GenerationRead:
    return await GenerationService(session).get(owner, generation_id)


@router.get("/{generation_id}/lineage", response_model=LineageResponse)
async def get_lineage(
    generation_id: UUID, session: SessionDep, owner: OwnerDep
) -> LineageResponse:
    return await GenerationService(session).lineage(owner, generation_id)
