"""문서 라우터 (document-backend §1)."""

from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Query, status

from src.common.deps import OwnerDep, SessionDep
from src.common.pagination import Page
from src.documents.schemas import (
    DocumentRead,
    DocumentUpdate,
    DownloadResponse,
    UploadInitRequest,
    UploadInitResponse,
)
from src.documents.service import DocumentService

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("", response_model=Page[DocumentRead])
async def list_documents(
    session: SessionDep,
    owner: OwnerDep,
    folder_id: UUID | None = Query(default=None),
    limit: int | None = Query(default=None),
    cursor: str | None = Query(default=None),
) -> Page[DocumentRead]:
    return await DocumentService(session).list(owner, folder_id, limit, cursor)


@router.get("/{document_id}", response_model=DocumentRead)
async def get_document(document_id: UUID, session: SessionDep, owner: OwnerDep) -> DocumentRead:
    return await DocumentService(session).get(owner, document_id)


@router.post("", response_model=UploadInitResponse, status_code=status.HTTP_201_CREATED)
async def init_upload(
    data: UploadInitRequest, session: SessionDep, owner: OwnerDep
) -> UploadInitResponse:
    return await DocumentService(session).upload_init(owner, data)


@router.post("/{document_id}/complete", response_model=DocumentRead)
async def complete_upload(
    document_id: UUID, session: SessionDep, owner: OwnerDep
) -> DocumentRead:
    return await DocumentService(session).upload_confirm(owner, document_id)


@router.post("/{document_id}/retry", response_model=DocumentRead)
async def retry_document(document_id: UUID, session: SessionDep, owner: OwnerDep) -> DocumentRead:
    # 실패한 문서를 전체 재실행으로 다시 처리한다(retry plan).
    return await DocumentService(session).retry(owner, document_id)


@router.patch("/{document_id}", response_model=DocumentRead)
async def update_document(
    document_id: UUID, data: DocumentUpdate, session: SessionDep, owner: OwnerDep
) -> DocumentRead:
    # 부분 갱신 — 폴더 이동(folder_id)·현재 파일명 변경(display_filename) 공용.
    return await DocumentService(session).update(owner, document_id, data)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(document_id: UUID, session: SessionDep, owner: OwnerDep) -> None:
    await DocumentService(session).delete(owner, document_id)


@router.get("/{document_id}/download", response_model=DownloadResponse)
async def download_document(
    document_id: UUID,
    session: SessionDep,
    owner: OwnerDep,
    disposition: Literal["attachment", "inline"] = "attachment",
) -> DownloadResponse:
    # disposition=inline: 인앱 미리보기(PDF/이미지)용 presigned GET (document-frontend §2)
    return await DocumentService(session).download(
        owner, document_id, inline=disposition == "inline"
    )
