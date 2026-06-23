"""문서 서비스 (document-backend §2·§3·§4).

업로드 3단계(init/confirm), presigned 다운로드, 삭제 수명주기, 목록·상세·이동.
owner 스코프 강제, confirm 멱등(중복 enqueue 방지).
"""

from uuid import UUID, uuid4

from minio.error import S3Error
from sqlalchemy.ext.asyncio import AsyncSession

from src.common.pagination import Page, clamp_limit, decode_cursor, encode_cursor
from src.config import settings
from src.documents.exceptions import (
    DocumentNotFound,
    RetryNotAllowed,
    UploadNotCompleted,
)
from src.documents.models import Document
from src.documents.repository import DocumentRepository
from src.documents.schemas import (
    DocumentRead,
    DocumentUpdate,
    DownloadResponse,
    UploadInitRequest,
    UploadInitResponse,
)
from src.folders.repository import FolderRepository
from src.pipeline.queue import abort_job, clear_job, enqueue
from src.storage import service as storage

INGEST_TASK = "ingest_document"

# 재시도 상한. 넘으면 거부해 독성 문서의 무한 재시도를 막는다(research 08 §6.1).
MAX_RETRIES = 5

# 영구 오류 표식. 코드나 형식 문제라 재시도로 복구되지 않는다(research 08 §6.2).
_PERMANENT_ERROR_MARKERS = ("지원하지 않는 파일 형식",)


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
            display_filename=data.original_filename,  # 현재 파일명 최초값 = 원본명
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

    async def retry(self, owner_id: UUID, document_id: UUID) -> DocumentRead:
        """실패한 문서를 전체 재실행으로 다시 처리한다. 전체 재실행은 멱등이라 안전하다.

        실패가 아니거나 상한을 넘었거나 영구 오류면 거부한다. 원본 객체가 없으면 재인제스트가
        불가하므로 재업로드를 안내한다(research 08 §6.1·§6.2, retry plan B2·B4·B5).
        """
        doc = await self._require(owner_id, document_id)
        if doc.status != "failed":
            raise RetryNotAllowed("실패한 문서만 재시도할 수 있습니다.", code="retry_not_failed")
        if doc.retry_count >= MAX_RETRIES:
            raise RetryNotAllowed("재시도 횟수 상한을 초과했습니다.", code="retry_limit_exceeded")
        if doc.error and any(m in doc.error for m in _PERMANENT_ERROR_MARKERS):
            raise RetryNotAllowed("재시도로 복구할 수 없는 오류입니다.", code="retry_permanent_error")

        # 원본 객체 확인. 없으면 저장된 객체로 재처리할 수 없어 재업로드가 필요하다.
        try:
            await storage.stat_object(doc.object_key)
        except S3Error as exc:
            raise UploadNotCompleted() from exc

        # 상태를 처리 중으로 되돌리고 재처리한다. run_ingest가 extracting부터 다시 시작한다.
        doc.status = "processing"
        doc.stage = None
        doc.error = None
        doc.retry_count += 1
        await self.session.commit()

        # arq 1시간 차단 해제: 같은 job_id의 이전 키를 지운 뒤 같은 키로 다시 enqueue한다.
        await clear_job(f"ingest:{document_id}")
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

    async def update(self, owner_id: UUID, document_id: UUID, data: DocumentUpdate) -> DocumentRead:
        # 부분 갱신 — 보낸 필드만 반영. 폴더 이동·현재 파일명 변경 공용.
        doc = await self._require(owner_id, document_id)
        fields = data.model_fields_set
        if "folder_id" in fields:
            await self._validate_folder(owner_id, data.folder_id)
            doc.folder_id = data.folder_id
        if "display_filename" in fields and data.display_filename is not None:
            doc.display_filename = data.display_filename.strip()
        await self.session.commit()
        await self.session.refresh(doc)
        return DocumentRead.model_validate(doc)

    async def download(
        self, owner_id: UUID, document_id: UUID, *, inline: bool = False
    ) -> DownloadResponse:
        doc = await self._require(owner_id, document_id)  # 발급 전 owner 검사
        url = await storage.presign_get(
            doc.object_key,
            filename=doc.display_filename,  # 다운로드는 현재 파일명으로
            inline=inline,
            content_type=doc.mime_type if inline else None,
        )
        return DownloadResponse(url=url)

    async def delete(self, owner_id: UUID, document_id: UUID) -> None:
        doc = await self._require(owner_id, document_id)
        object_key = doc.object_key
        # 진행 중 인제스트 선제 취소(best-effort) — row 삭제 전에 신호해 낭비 작업·에러 로그를 줄인다.
        # job이 없으면 무해(no-op). row 삭제가 최종 hard stop. (04-frontend D13)
        await abort_job(f"ingest:{document_id}")
        await self.repo.delete(doc)  # 청크 CASCADE
        await self.session.commit()
        await storage.delete_object(object_key)  # 멱등
