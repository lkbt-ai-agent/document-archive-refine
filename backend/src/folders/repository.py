"""폴더 리포지토리 (folders-backend §2, folders-schema §4).

모든 쿼리에 owner_id를 강제한다. 트리 조회·사이클 검사·하위 오브젝트 키 수집은 재귀 CTE.
"""

from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.folders.models import Folder


class FolderRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_tree(self, owner_id: UUID) -> list[Folder]:
        """소유자 전체 폴더를 재귀 CTE로 평면 리스트 반환 (folders-schema §4)."""
        rows = (
            await self.session.execute(
                text(
                    """
                    WITH RECURSIVE tree AS (
                      SELECT * FROM archive.folders
                      WHERE owner_id = :owner AND parent_id IS NULL
                      UNION ALL
                      SELECT f.* FROM archive.folders f JOIN tree t ON f.parent_id = t.id
                    )
                    SELECT id, parent_id, name, created_at, updated_at FROM tree
                    ORDER BY name
                    """
                ),
                {"owner": owner_id},
            )
        ).mappings()
        return [Folder(**row) for row in rows]

    async def get(self, owner_id: UUID, folder_id: UUID) -> Folder | None:
        return (
            await self.session.execute(
                select(Folder).where(Folder.id == folder_id, Folder.owner_id == owner_id)
            )
        ).scalar_one_or_none()

    async def create(self, owner_id: UUID, parent_id: UUID | None, name: str) -> Folder:
        folder = Folder(owner_id=owner_id, parent_id=parent_id, name=name)
        self.session.add(folder)
        await self.session.flush()
        return folder

    async def is_descendant(self, folder_id: UUID, candidate_id: UUID) -> bool:
        """candidate_id가 folder_id 자신 또는 그 후손이면 True (이동 사이클 검사)."""
        return bool(
            await self.session.scalar(
                text(
                    """
                    WITH RECURSIVE descendants AS (
                      SELECT id FROM archive.folders WHERE id = :fid
                      UNION ALL
                      SELECT f.id FROM archive.folders f
                        JOIN descendants d ON f.parent_id = d.id
                    )
                    SELECT EXISTS(SELECT 1 FROM descendants WHERE id = :cid)
                    """
                ),
                {"fid": folder_id, "cid": candidate_id},
            )
        )

    async def collect_object_keys(self, owner_id: UUID, folder_id: UUID) -> list[str]:
        """폴더 서브트리에 속한 모든 문서의 object_key 수집 (삭제 위임용)."""
        rows = (
            await self.session.execute(
                text(
                    """
                    WITH RECURSIVE sub AS (
                      SELECT id FROM archive.folders WHERE id = :fid AND owner_id = :owner
                      UNION ALL
                      SELECT f.id FROM archive.folders f JOIN sub s ON f.parent_id = s.id
                    )
                    SELECT object_key FROM archive.documents
                    WHERE folder_id IN (SELECT id FROM sub)
                    """
                ),
                {"fid": folder_id, "owner": owner_id},
            )
        ).scalars()
        return list(rows)

    async def delete(self, folder: Folder) -> None:
        await self.session.delete(folder)
        await self.session.flush()
