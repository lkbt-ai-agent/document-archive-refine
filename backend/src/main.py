"""FastAPI 앱 팩토리 (backend.md §3·§7·§11).

라우터 등록, CORS, 예외 핸들러, 기동 시 핵심 의존(PG/MinIO) fail-fast를 구성한다.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import src.db_models  # noqa: F401  # 전 모델 등록(FK 상호참조 해석에 필요)
from src.common.errors import register_exception_handlers
from src.config import settings
from src.health import assert_core_dependencies, health_report

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(_: FastAPI):
    # 기동 시 PG/MinIO 도달 실패는 fail-fast (backend.md §11)
    await assert_core_dependencies()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="Mechive API", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_origin_regex=settings.cors_origin_regex,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)

    @app.get("/health")
    async def health() -> dict:
        report = await health_report()
        return {"ok": report["postgres"] and report["minio"], "checks": report}

    _register_routers(app)
    return app


def _register_routers(app: FastAPI) -> None:
    """도메인 라우터 등록. 구현된 도메인만 점진적으로 추가한다(D~H)."""
    from src.documents.router import router as documents_router
    from src.folders.router import router as folders_router
    from src.generations.router import router as generations_router
    from src.search.router import router as search_router

    app.include_router(folders_router)
    app.include_router(documents_router)
    app.include_router(search_router)
    app.include_router(generations_router)


app = create_app()
