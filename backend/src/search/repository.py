"""검색 리포지토리 (search-schema §1·§2, search-backend §3).

키워드는 PGroonga(`&@~`), 미가용 시 `tsvector('simple')` 폴백. 의미는 pgvector HNSW cosine.
소유자 필터는 상위 문서를 경유해 강제하고, 폴더·기간 필터를 선택 적용한다.
"""

from datetime import datetime
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.documents.models import Document, DocumentChunk


def _doc_filter_sql(folder_id: UUID | None, date_from: datetime | None, date_to: datetime | None):
    clauses, params = [], {}
    if folder_id is not None:
        clauses.append("AND d.folder_id = :folder")
        params["folder"] = folder_id
    if date_from is not None:
        clauses.append("AND d.created_at >= :date_from")
        params["date_from"] = date_from
    if date_to is not None:
        clauses.append("AND d.created_at <= :date_to")
        params["date_to"] = date_to
    return " ".join(clauses), params


class SearchRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def keyword(
        self,
        owner_id: UUID,
        q: str,
        limit: int,
        folder_id: UUID | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> list[dict]:
        filt, params = _doc_filter_sql(folder_id, date_from, date_to)
        params |= {"u": owner_id, "q": q, "limit": limit}
        select_cols = (
            "c.document_id, c.id AS chunk_id, c.content, "
            "d.display_filename, d.llm_title, d.keywords, d.folder_id, d.created_at"
        )
        join = "JOIN archive.documents d ON d.id = c.document_id"
        where = f"d.owner_id = :u {filt}"
        # 1차: PGroonga
        pgroonga_sql = (
            f"SELECT {select_cols}, pgroonga_score(c.tableoid, c.ctid) AS score "
            f"FROM archive.document_chunks c {join} "
            f"WHERE c.content &@~ :q AND {where} ORDER BY score DESC LIMIT :limit"
        )
        try:
            rows = (await self.session.execute(text(pgroonga_sql), params)).mappings().all()
            return [dict(r) for r in rows]
        except Exception:  # noqa: BLE001  # PGroonga 미가용 → tsvector 폴백(품질↓)
            await self.session.rollback()
            fallback_sql = (
                f"SELECT {select_cols}, "
                f"ts_rank(to_tsvector('simple', c.content), plainto_tsquery('simple', :q)) AS score "
                f"FROM archive.document_chunks c {join} "
                f"WHERE to_tsvector('simple', c.content) @@ plainto_tsquery('simple', :q) "
                f"AND {where} ORDER BY score DESC LIMIT :limit"
            )
            rows = (await self.session.execute(text(fallback_sql), params)).mappings().all()
            return [dict(r) for r in rows]

    async def semantic(
        self,
        owner_id: UUID,
        query_vector: list[float],
        limit: int,
        folder_id: UUID | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> list[dict]:
        distance = DocumentChunk.embedding.cosine_distance(query_vector).label("distance")
        stmt = (
            select(
                DocumentChunk.document_id,
                DocumentChunk.id.label("chunk_id"),
                DocumentChunk.content,
                Document.display_filename,
                Document.llm_title,
                Document.keywords,
                Document.folder_id,
                Document.created_at,
                distance,
            )
            .join(Document, Document.id == DocumentChunk.document_id)
            .where(Document.owner_id == owner_id)
        )
        if folder_id is not None:
            stmt = stmt.where(Document.folder_id == folder_id)
        if date_from is not None:
            stmt = stmt.where(Document.created_at >= date_from)
        if date_to is not None:
            stmt = stmt.where(Document.created_at <= date_to)
        stmt = stmt.order_by(distance).limit(limit)
        rows = (await self.session.execute(stmt)).mappings().all()
        return [dict(r) for r in rows]
