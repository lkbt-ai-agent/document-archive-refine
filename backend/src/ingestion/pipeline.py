"""인제스트 오케스트레이션 (ingestion.md §4, ingestion-backend §1·§2).

스테이지: extracting → generating_meta → chunking → embedding → ready.
각 단계에서 `documents.status/stage`를 갱신하고, 실패 시 `failed`+`error`를 기록한다.
완료 시 `ingest_ms`를 기록한다. 청크 적재는 멱등 upsert(F6), sha256은 인제스트 중 계산(F7).
"""

import asyncio
import hashlib
import io
import logging
import time
from uuid import UUID

from PIL import Image

from src.ai.provider import get_embedding_client
from src.database import async_session
from src.ingestion import detect
from src.ingestion.chunking import chunk_text
from src.ingestion.extract_pdf import extract_pdf
from src.ingestion.extract_text import extract_md, extract_txt
from src.ingestion.meta import detect_language, generate_meta
from src.ingestion.ocr import ocr_image
from src.ingestion.repository import IngestRepository
from src.storage import service as storage

logger = logging.getLogger("mechive.ingest")

EMBED_BATCH = 32


async def _extract(kind: str, data: bytes) -> tuple[str, dict]:
    """파일 타입별 4갈래 택일 추출 (ingestion.md §3-2). CPU 작업은 스레드로 오프로드."""
    if kind == detect.PDF:
        result = await asyncio.to_thread(extract_pdf, data)
        return result["text"], result["meta"]
    if kind == detect.IMAGE:
        img = Image.open(io.BytesIO(data))
        text = await asyncio.to_thread(ocr_image, img)
        return text, {}
    if kind == detect.MARKDOWN:
        return extract_md(data), {}
    if kind == detect.TEXT:
        return extract_txt(data), {}
    raise ValueError(f"지원하지 않는 파일 형식: {kind}")


async def _embed_all(chunks: list[str]) -> list[list[float]]:
    emb = get_embedding_client()
    vectors: list[list[float]] = []
    for i in range(0, len(chunks), EMBED_BATCH):
        vectors.extend(await emb.embed(chunks[i : i + EMBED_BATCH]))
    return vectors


async def run_ingest(document_id: str) -> None:
    doc_uuid = UUID(document_id)
    start = time.monotonic()
    async with async_session() as session:
        repo = IngestRepository(session)
        doc = await repo.get(doc_uuid)
        if doc is None:
            logger.warning("ingest: 문서 없음 %s", document_id)
            return
        try:
            # 1) 추출 (OCR 포함)
            doc.status, doc.stage, doc.error = "processing", "extracting", None
            await session.commit()
            data = await storage.get_bytes(doc.object_key)
            doc.sha256 = hashlib.sha256(data).hexdigest()  # F7
            kind = detect.detect_kind(data, doc.original_filename)
            text, meta = await _extract(kind, data)
            if meta.get("page_count") is not None:
                doc.page_count = meta["page_count"]
            if meta.get("author"):
                doc.author = meta["author"]
            if meta.get("doc_created_at"):
                doc.doc_created_at = meta["doc_created_at"]
            if meta.get("doc_modified_at"):
                doc.doc_modified_at = meta["doc_modified_at"]
            await session.commit()

            # 2) 메타 생성
            doc.stage = "generating_meta"
            await session.commit()
            if text.strip():
                doc.language = detect_language(text)
                dm = await generate_meta(text)
                doc.llm_title, doc.llm_summary = dm.title, dm.summary
                doc.topics, doc.keywords = dm.topics, dm.keywords
                await session.commit()

            # 3) 청킹
            doc.stage = "chunking"
            await session.commit()
            chunks = await chunk_text(text)

            # 4) 임베딩 + 멱등 적재
            doc.stage = "embedding"
            await session.commit()
            vectors = await _embed_all(chunks)
            rows = [
                {
                    "document_id": doc_uuid,
                    "chunk_index": i,
                    "content": c,
                    "embedding": v,
                    "metadata": None,
                    "parent_doc_id": None,
                }
                for i, (c, v) in enumerate(zip(chunks, vectors))
            ]
            await repo.upsert_chunks(doc_uuid, rows)

            # 5) 완료
            doc.status, doc.stage = "ready", None
            doc.ingest_ms = int((time.monotonic() - start) * 1000)
            await session.commit()
            logger.info("ingest 완료 %s: chunks=%d ingest_ms=%d", document_id, len(rows), doc.ingest_ms)
        except Exception as exc:
            await session.rollback()
            failed = await repo.get(doc_uuid)
            if failed is not None:
                failed.status, failed.stage = "failed", None
                failed.error = str(exc)[:2000]
                await session.commit()
            logger.exception("ingest 실패 %s: %s", document_id, exc)
            raise
