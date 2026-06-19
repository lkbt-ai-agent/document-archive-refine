"""arq 작업 정의 (ingestion-backend §1).

- ingest_document: 업로드 확정 후 인제스트 파이프라인 실행(상세는 src.ingestion).
- run_generation: AI 산출물 생성 실행(ai-outputs-backend §2).
"""


async def ingest_document(ctx, document_id: str) -> None:
    """인제스트 진입점. 멱등 키 `(document_id, stage)`로 단계별 재시작 (ingestion-backend §1)."""
    from src.ingestion.pipeline import run_ingest

    await run_ingest(document_id)


async def run_generation(ctx, generation_id: str) -> None:
    """AI 산출물 생성 진입점. 멱등 키 `generation_id` (ai-outputs-backend §2)."""
    from src.generations.runner import run

    await run(generation_id)
