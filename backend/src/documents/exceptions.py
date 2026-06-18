"""문서 도메인 예외 (document-backend §1)."""

from src.common.exceptions import BadRequestError, NotFoundError


class DocumentNotFound(NotFoundError):
    def __init__(self) -> None:
        super().__init__("문서를 찾을 수 없습니다.", code="document_not_found")


class UploadNotCompleted(BadRequestError):
    def __init__(self) -> None:
        super().__init__(
            "업로드가 확인되지 않았습니다(오브젝트 없음).", code="upload_not_completed"
        )
