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


class RetryNotAllowed(BadRequestError):
    """재시도를 허용할 수 없음 — 실패 아님·상한 초과·영구 오류 (retry plan B2·B4·B5)."""

    def __init__(self, message: str, *, code: str) -> None:
        super().__init__(message, code=code)
