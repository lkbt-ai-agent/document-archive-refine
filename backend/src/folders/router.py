"""폴더 라우터 (folders-backend §1)."""

from uuid import UUID

from fastapi import APIRouter, status

from src.common.deps import OwnerDep, SessionDep
from src.folders.schemas import FolderCreate, FolderRead, FolderUpdate
from src.folders.service import FolderService

router = APIRouter(prefix="/folders", tags=["folders"])


@router.get("", response_model=list[FolderRead])
async def list_folders(session: SessionDep, owner: OwnerDep) -> list[FolderRead]:
    return await FolderService(session).list_tree(owner)


@router.post("", response_model=FolderRead, status_code=status.HTTP_201_CREATED)
async def create_folder(data: FolderCreate, session: SessionDep, owner: OwnerDep) -> FolderRead:
    return await FolderService(session).create(owner, data)


@router.patch("/{folder_id}", response_model=FolderRead)
async def update_folder(
    folder_id: UUID, data: FolderUpdate, session: SessionDep, owner: OwnerDep
) -> FolderRead:
    return await FolderService(session).update(owner, folder_id, data)


@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_folder(folder_id: UUID, session: SessionDep, owner: OwnerDep) -> None:
    await FolderService(session).delete(owner, folder_id)
