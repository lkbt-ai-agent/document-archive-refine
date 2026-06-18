"""arq 작업 정의 (ingestion-backend §1, document-backend §4).

- ingest_document: 업로드 확정 후 인제스트 파이프라인 실행(상세는 F에서 src.ingestion에 구현).
- cleanup_orphans: 24h 초과 미완 업로드(`uploaded`) 행을 오브젝트 부재 확인 후 정리(E5).
"""

import logging
from datetime import UTC, datetime, timedelta

from src.database import async_session
from src.documents.repository import DocumentRepository
from src.storage import service as storage

logger = logging.getLogger("mechive.pipeline")

ORPHAN_AGE = timedelta(hours=24)


async def ingest_document(ctx, document_id: str) -> None:
    """인제스트 진입점. 멱등 키 `(document_id, stage)`로 단계별 재시작 (ingestion-backend §1)."""
    from src.ingestion.pipeline import run_ingest

    await run_ingest(document_id)


async def cleanup_orphans(ctx) -> dict:
    """주기 잡(매시): `uploaded`로 24h 방치된 행을 stat_object 부재 확인 후 삭제."""
    cutoff = datetime.now(UTC) - ORPHAN_AGE
    removed = 0
    async with async_session() as session:
        repo = DocumentRepository(session)
        orphans = await repo.find_orphans(cutoff)
        for doc in orphans:
            if not await storage.object_exists(doc.object_key):
                await session.delete(doc)
                removed += 1
        await session.commit()
    logger.info("cleanup_orphans: checked=%d removed=%d", len(orphans), removed)
    return {"checked": len(orphans), "removed": removed}
