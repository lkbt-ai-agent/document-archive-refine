"""문서 리포지토리 (document-backend §2). 모든 쿼리 owner 스코프 강제."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from src.documents.models import Document
from src.documents.schemas import DocumentSort

# 정렬 모드 → (정렬 키 컬럼, 내림차순 여부). id는 항상 같은 방향의 동점 결정 키로 덧붙인다.
_SORT_SPEC: dict[DocumentSort, tuple[InstrumentedAttribute, bool]] = {
    DocumentSort.newest: (Document.created_at, True),
    DocumentSort.oldest: (Document.created_at, False),
    DocumentSort.name_asc: (Document.display_filename, False),
    DocumentSort.name_desc: (Document.display_filename, True),
}


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
        sort: DocumentSort,
        cursor: tuple[str, UUID] | None,
    ) -> list[Document]:
        """keyset 페이지네이션: 정렬 키 컬럼과 id를 묶어 자른다. limit+1로 다음 페이지 존재 여부 판단.

        cursor는 (정렬 키 값 문자열, id)다. created_at 정렬이면 ISO 문자열을 datetime으로 되돌려
        timestamptz와 정확히 비교한다. 내림차순은 `<`, 오름차순은 `>`로 다음 페이지를 가른다.
        """
        col, is_desc = _SORT_SPEC[sort]
        stmt = select(Document).where(Document.owner_id == owner_id)
        stmt = stmt.where(
            Document.folder_id == folder_id
            if folder_id is not None
            else Document.folder_id.is_(None)
        )
        if cursor is not None:
            value_str, last_id = cursor
            value = (
                datetime.fromisoformat(value_str)
                if col is Document.created_at
                else value_str
            )
            keyset = tuple_(col, Document.id)
            stmt = stmt.where(keyset < (value, last_id) if is_desc else keyset > (value, last_id))
        order = (
            (col.desc(), Document.id.desc()) if is_desc else (col.asc(), Document.id.asc())
        )
        stmt = stmt.order_by(*order).limit(limit + 1)
        return list((await self.session.execute(stmt)).scalars().all())

    async def delete(self, document: Document) -> None:
        await self.session.delete(document)
        await self.session.flush()
