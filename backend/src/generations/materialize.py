"""산출물 문서화 (ai-outputs.md §9, ai-outputs-backend §7).

성공한 생성의 산출물(Markdown; report는 차트 spec 포함)을 오브젝트로 업로드하고 `documents`
행을 만들어 인제스트(청킹·임베딩)까지 수행한다. 폴더는 주 원본 문서와 동일.
"""

import json
from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.documents.models import Document
from src.ingestion.pipeline import run_ingest
from src.storage import service as storage

_KIND_KO = {"summary": "요약", "draft": "초안", "report": "보고서"}


def compose_markdown(output_text: str, charts: list) -> str:
    """report는 차트 spec을 vega-lite 코드블록으로 본문에 덧붙인다."""
    parts = [output_text]
    for ch in charts:
        parts.append(f"```vega-lite\n{json.dumps(ch.spec, ensure_ascii=False, indent=2)}\n```")
    return "\n\n".join(parts)


async def materialize(
    session: AsyncSession,
    *,
    owner_id: UUID,
    kind: str,
    markdown: str,
    folder_id: UUID | None,
    title_hint: str | None,
) -> UUID:
    doc_id = uuid4()
    object_key = f"docs/{doc_id}"
    data = markdown.encode("utf-8")
    base = title_hint or _KIND_KO.get(kind, kind)
    filename = f"{base} ({_KIND_KO.get(kind, kind)}).md"

    await storage.put_bytes(object_key, data, "text/markdown")
    session.add(
        Document(
            id=doc_id,
            owner_id=owner_id,
            folder_id=folder_id,
            object_key=object_key,
            bucket=settings.minio_bucket,
            original_filename=filename,
            mime_type="text/markdown",
            size_bytes=len(data),
            status="uploaded",
        )
    )
    await session.commit()

    # 일반 문서와 동일하게 인제스트(청킹·임베딩·메타) — 목록·검색·RAG 대상이 된다.
    await run_ingest(str(doc_id))
    return doc_id
