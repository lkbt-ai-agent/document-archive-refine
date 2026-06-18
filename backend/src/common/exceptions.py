"""도메인 예외 계층 (backend.md §7).

service/repository는 이 예외를 던지고, 예외 핸들러(common/errors.py)가 HTTP로 매핑한다.
라우터는 HTTP 상태코드를 직접 다루지 않는다.
"""

from typing import Any


class AppError(Exception):
    """애플리케이션 공통 예외 베이스."""

    status_code: int = 500
    code: str = "internal_error"

    def __init__(
        self,
        message: str,
        *,
        code: str | None = None,
        status_code: int | None = None,
        details: Any | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        if code is not None:
            self.code = code
        if status_code is not None:
            self.status_code = status_code
        self.details = details


class NotFoundError(AppError):
    """대상 없음 또는 소유자 외 접근 (backend.md §7: 권한 외 404)."""

    status_code = 404
    code = "not_found"


class ConflictError(AppError):
    """충돌 — 형제 폴더 중복명 등 (folders-backend §1: 409)."""

    status_code = 409
    code = "conflict"


class UnprocessableError(AppError):
    """검증은 통과했으나 규칙 위반 — 사이클 이동 등 (folders-backend §1: 422)."""

    status_code = 422
    code = "unprocessable"


class BadRequestError(AppError):
    """잘못된 요청 — upload confirm 검증 실패 등 (document-backend §1: 4xx)."""

    status_code = 400
    code = "bad_request"
