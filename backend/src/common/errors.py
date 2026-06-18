"""공통 에러 응답 모델 + 예외 핸들러 등록 (backend.md §7).

모든 에러는 `{"error": {"code", "message", "details"}}` 형태로 직렬화한다.
"""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from src.common.exceptions import AppError

logger = logging.getLogger("mechive.errors")


class ErrorBody(BaseModel):
    code: str
    message: str
    details: object | None = None


class ErrorResponse(BaseModel):
    error: ErrorBody


def _payload(code: str, message: str, details: object | None = None) -> dict:
    return ErrorResponse(error=ErrorBody(code=code, message=message, details=details)).model_dump()


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_payload(exc.code, exc.message, exc.details),
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content=_payload("validation_error", "요청 검증 실패", exc.errors()),
        )

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("unhandled error: %s", exc)
        return JSONResponse(
            status_code=500,
            content=_payload("internal_error", "서버 내부 오류"),
        )
