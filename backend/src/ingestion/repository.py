"""인제스트 리포지토리 (ingestion-backend §2-5, documents-schema §1).

워커 컨텍스트(owner 비스코프, document_id로 직접 접근)에서 문서 로드와 청크 멱등 upsert를
담당한다.
"""

from uuid import UUID

from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.documents.models import Document, DocumentChunk


class IngestRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, document_id: UUID) -> Document | None:
        return await self.session.get(Document, document_id)

    async def upsert_chunks(self, document_id: UUID, rows: list[dict]) -> None:
        """`ON CONFLICT (document_id, chunk_index) DO UPDATE`로 멱등 적재.

        재실행 시 청크 수가 줄면 꼬리(index >= 새 개수)를 삭제해 일관성을 유지한다.
        """
        table = DocumentChunk.__table__
        if rows:
            stmt = pg_insert(table).values(rows)
            stmt = stmt.on_conflict_do_update(
                index_elements=["document_id", "chunk_index"],
                set_={
                    "content": stmt.excluded.content,
                    "embedding": stmt.excluded.embedding,
                    "metadata": stmt.excluded.metadata,
                    "parent_doc_id": stmt.excluded.parent_doc_id,
                },
            )
            await self.session.execute(stmt)

        await self.session.execute(
            delete(table).where(
                table.c.document_id == document_id, table.c.chunk_index >= len(rows)
            )
        )
