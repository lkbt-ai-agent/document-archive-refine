"""폴더 서비스 (folders.md §4·§5·§6, folders-backend §2).

owner 스코프 강제, 형제 중복명(409), 사이클 이동(422), 재귀 삭제 시 MinIO 오브젝트 위임 삭제.
"""

from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.folders.exceptions import CyclicMove, DuplicateSiblingName, FolderNotFound
from src.folders.repository import FolderRepository
from src.folders.schemas import FolderCreate, FolderRead, FolderUpdate
from src.storage import service as storage


class FolderService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = FolderRepository(session)

    async def list_tree(self, owner_id: UUID) -> list[FolderRead]:
        folders = await self.repo.list_tree(owner_id)
        return [FolderRead.model_validate(f) for f in folders]

    async def _require(self, owner_id: UUID, folder_id: UUID):
        folder = await self.repo.get(owner_id, folder_id)
        if folder is None:
            raise FolderNotFound()
        return folder

    async def create(self, owner_id: UUID, data: FolderCreate) -> FolderRead:
        if data.parent_id is not None:
            await self._require(owner_id, data.parent_id)  # 부모 소유 검증
        try:
            folder = await self.repo.create(owner_id, data.parent_id, data.name)
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            raise DuplicateSiblingName() from exc
        return FolderRead.model_validate(folder)

    async def update(self, owner_id: UUID, folder_id: UUID, data: FolderUpdate) -> FolderRead:
        folder = await self._require(owner_id, folder_id)
        fields = data.model_fields_set

        if "parent_id" in fields:
            new_parent = data.parent_id
            if new_parent is not None:
                await self._require(owner_id, new_parent)  # 대상 부모 소유 검증
                # 새 부모가 자신 또는 후손이면 사이클 (folders-schema §4)
                if await self.repo.is_descendant(folder_id, new_parent):
                    raise CyclicMove()
            folder.parent_id = new_parent

        if "name" in fields and data.name is not None:
            folder.name = data.name

        try:
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            raise DuplicateSiblingName() from exc
        await self.session.refresh(folder)
        return FolderRead.model_validate(folder)

    async def delete(self, owner_id: UUID, folder_id: UUID) -> None:
        folder = await self._require(owner_id, folder_id)
        # 삭제 대상 문서 오브젝트 키를 먼저 수집(CASCADE 전), DB 삭제 후 MinIO 위임 삭제
        object_keys = await self.repo.collect_object_keys(owner_id, folder_id)
        await self.repo.delete(folder)
        await self.session.commit()
        await storage.delete_objects(object_keys)
