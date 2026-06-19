"""문서 리포지토리 (document-backend §2). 모든 쿼리 owner 스코프 강제."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from src.documents.models import Document


class DocumentRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, owner_id: UUID, document_id: UUID) -> Document | None:
        return (
            await self.session.execute(
                select(Document).where(
                    Document.id == document_id, Document.owner_id == owner_id
                )
            )
        ).scalar_one_or_none()

    async def add(self, document: Document) -> Document:
        self.session.add(document)
        await self.session.flush()
        return document

    async def list_by_folder(
        self,
        owner_id: UUID,
        folder_id: UUID | None,
        limit: int,
        cursor: tuple[datetime, UUID] | None,
    ) -> list[Document]:
        """keyset 페이지네이션: (created_at, id) DESC. limit+1로 다음 페이지 존재 여부 판단."""
        stmt = select(Document).where(Document.owner_id == owner_id)
        stmt = stmt.where(
            Document.folder_id == folder_id
            if folder_id is not None
            else Document.folder_id.is_(None)
        )
        if cursor is not None:
            stmt = stmt.where(tuple_(Document.created_at, Document.id) < cursor)
        stmt = stmt.order_by(Document.created_at.desc(), Document.id.desc()).limit(limit + 1)
        return list((await self.session.execute(stmt)).scalars().all())

    async def delete(self, document: Document) -> None:
        await self.session.delete(document)
        await self.session.flush()
