"""문서 서비스 (document-backend §2·§3·§4).

업로드 3단계(init/confirm), presigned 다운로드, 삭제 수명주기, 목록·상세·이동.
owner 스코프 강제, confirm 멱등(중복 enqueue 방지).
"""

from uuid import UUID, uuid4

from minio.error import S3Error
from sqlalchemy.ext.asyncio import AsyncSession

from src.common.pagination import Page, clamp_limit, decode_cursor, encode_cursor
from src.config import settings
from src.documents.exceptions import DocumentNotFound, UploadNotCompleted
from src.documents.models import Document
from src.documents.repository import DocumentRepository
from src.documents.schemas import (
    DocumentRead,
    DownloadResponse,
    UploadInitRequest,
    UploadInitResponse,
)
from src.folders.repository import FolderRepository
from src.pipeline.queue import enqueue
from src.storage import service as storage

INGEST_TASK = "ingest_document"


class DocumentService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = DocumentRepository(session)
        self.folders = FolderRepository(session)

    async def _require(self, owner_id: UUID, document_id: UUID) -> Document:
        doc = await self.repo.get(owner_id, document_id)
        if doc is None:
            raise DocumentNotFound()
        return doc

    async def _validate_folder(self, owner_id: UUID, folder_id: UUID | None) -> None:
        if folder_id is not None and await self.folders.get(owner_id, folder_id) is None:
            raise DocumentNotFound()  # 폴더 미소유 → 노출 차단

    async def upload_init(self, owner_id: UUID, data: UploadInitRequest) -> UploadInitResponse:
        await self._validate_folder(owner_id, data.folder_id)
        doc_id = uuid4()
        object_key = f"docs/{doc_id}"  # documents-minio §1
        doc = Document(
            id=doc_id,
            owner_id=owner_id,
            folder_id=data.folder_id,
            object_key=object_key,
            bucket=settings.minio_bucket,
            original_filename=data.original_filename,
            mime_type=data.mime_type,
            size_bytes=data.size_bytes,
            status="uploaded",
        )
        await self.repo.add(doc)
        await self.session.commit()
        upload_url = await storage.presign_put(object_key)
        return UploadInitResponse(
            document_id=doc_id, object_key=object_key, bucket=settings.minio_bucket, upload_url=upload_url
        )

    async def upload_confirm(self, owner_id: UUID, document_id: UUID) -> DocumentRead:
        doc = await self._require(owner_id, document_id)
        # 멱등: 이미 처리/완료면 추가 처리 없이 무시 (document-backend §5)
        if doc.status in ("processing", "ready"):
            return DocumentRead.model_validate(doc)

        try:
            stat = await storage.stat_object(doc.object_key)
        except S3Error as exc:
            raise UploadNotCompleted() from exc

        doc.size_bytes = stat.size
        if not doc.mime_type and getattr(stat, "content_type", None):
            doc.mime_type = stat.content_type
        doc.status = "processing"
        await self.session.commit()

        # 멱등 키로 중복 enqueue 방지 (backend §10)
        await enqueue(INGEST_TASK, str(document_id), _job_id=f"ingest:{document_id}")
        await self.session.refresh(doc)
        return DocumentRead.model_validate(doc)

    async def get(self, owner_id: UUID, document_id: UUID) -> DocumentRead:
        return DocumentRead.model_validate(await self._require(owner_id, document_id))

    async def list(
        self, owner_id: UUID, folder_id: UUID | None, limit: int | None, cursor: str | None
    ) -> Page[DocumentRead]:
        n = clamp_limit(limit)
        decoded = decode_cursor(cursor) if cursor else None
        rows = await self.repo.list_by_folder(owner_id, folder_id, n, decoded)
        next_cursor = None
        if len(rows) > n:
            last = rows[n - 1]
            next_cursor = encode_cursor(last.created_at, last.id)
            rows = rows[:n]
        return Page(items=[DocumentRead.model_validate(r) for r in rows], next_cursor=next_cursor)

    async def move(self, owner_id: UUID, document_id: UUID, folder_id: UUID | None) -> DocumentRead:
        doc = await self._require(owner_id, document_id)
        await self._validate_folder(owner_id, folder_id)
        doc.folder_id = folder_id
        await self.session.commit()
        await self.session.refresh(doc)
        return DocumentRead.model_validate(doc)

    async def download(self, owner_id: UUID, document_id: UUID) -> DownloadResponse:
        doc = await self._require(owner_id, document_id)  # 발급 전 owner 검사
        url = await storage.presign_get(doc.object_key, filename=doc.original_filename)
        return DownloadResponse(url=url)

    async def delete(self, owner_id: UUID, document_id: UUID) -> None:
        doc = await self._require(owner_id, document_id)
        object_key = doc.object_key
        await self.repo.delete(doc)  # 청크 CASCADE
        await self.session.commit()
        await storage.delete_object(object_key)  # 멱등
