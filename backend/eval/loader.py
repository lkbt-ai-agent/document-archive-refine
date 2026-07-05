"""코퍼스·케이스 적재 (research 03-search-eval-testset/01 §3).

핀된 코퍼스 중 앱에 아직 없는 파일만 실제 인제스트 파이프라인(MinIO 업로드, arq 잡)으로
SEED_USER_ID에 적재하고, sha256에서 document_id로 가는 매핑을 산출한 뒤 케이스 정답을 해소한다.
"""

import asyncio
import hashlib
import time
from pathlib import Path
from uuid import UUID, uuid4

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from eval import schemas
from eval.context import EVAL_OWNER_ID, eval_session
from src.config import settings
from src.documents.models import Document
from src.pipeline.queue import clear_job, enqueue
from src.storage import service as storage

INGEST_TASK = "ingest_document"
SAMPLE_DIR = Path(__file__).resolve().parents[2] / "sample-datas"

_WAIT_TIMEOUT_S = 1800
_WAIT_INTERVAL_S = 5


def _local_path(entry: schemas.CorpusEntry) -> Path:
    return SAMPLE_DIR / entry.source / entry.filename


def _mime(name: str) -> str:
    return "application/pdf" if name.lower().endswith(".pdf") else "application/octet-stream"


def _verify_sha256(corpus: list[schemas.CorpusEntry]) -> list[str]:
    """로컬 파일의 sha256이 manifest 값과 같은 원본 바이트 해시인지 검증한다(01 §3.1)."""
    problems: list[str] = []
    for e in corpus:
        path = _local_path(e)
        if not path.exists():
            problems.append(f"파일 없음: {path}")
            continue
        actual = hashlib.sha256(path.read_bytes()).hexdigest()
        if actual != e.sha256:
            problems.append(f"sha256 불일치: {e.filename} (manifest {e.sha256[:12]}, 실제 {actual[:12]})")
    return problems


def _static_check(corpus: list[schemas.CorpusEntry], cases: list[schemas.Case]) -> list[str]:
    """케이스 정답 sha256이 핀 목록에 있는지 오프라인으로 확인한다."""
    corpus_shas = {e.sha256 for e in corpus}
    missing: list[str] = []
    for case in cases:
        for did in case.answer_doc_ids:
            if did.rsplit(":", 1)[1] not in corpus_shas:
                missing.append(f"{case.id} -> {did}")
    return missing


async def _existing_sha256(session: AsyncSession) -> dict[str, str]:
    """평가 owner가 이미 가진 문서의 sha256에서 document_id로 가는 매핑(모든 상태)."""
    rows = (
        await session.execute(
            text(
                "SELECT sha256, id FROM archive.documents "
                "WHERE owner_id = :u AND sha256 IS NOT NULL"
            ),
            {"u": EVAL_OWNER_ID},
        )
    ).mappings().all()
    return {r["sha256"]: str(r["id"]) for r in rows}


async def _ready_mapping(session: AsyncSession, shas: set[str]) -> dict[str, str]:
    """ready 상태 문서만으로 sha256에서 document_id 매핑을 만든다(01 §3.1)."""
    rows = (
        await session.execute(
            text(
                "SELECT sha256, id FROM archive.documents "
                "WHERE owner_id = :u AND status = 'ready' AND sha256 IS NOT NULL"
            ),
            {"u": EVAL_OWNER_ID},
        )
    ).mappings().all()
    return {r["sha256"]: str(r["id"]) for r in rows if r["sha256"] in shas}


async def build_mapping(session: AsyncSession) -> dict[str, str]:
    """핀 코퍼스의 sha256에서 ready 문서 document_id로 가는 매핑을 만든다(runner 재사용)."""
    corpus = schemas.read_corpus()
    return await _ready_mapping(session, {e.sha256 for e in corpus})


async def _ingest_new(session: AsyncSession, entry: schemas.CorpusEntry) -> UUID:
    """문서 행 생성, MinIO 직접 업로드, 인제스트 잡 enqueue(upload_init·confirm의 서버측 판)."""
    data = _local_path(entry).read_bytes()
    doc_id = uuid4()
    object_key = f"docs/{doc_id}"  # documents-minio §1
    session.add(
        Document(
            id=doc_id,
            owner_id=EVAL_OWNER_ID,
            folder_id=None,
            object_key=object_key,
            bucket=settings.minio_bucket,
            original_filename=entry.filename,
            display_filename=entry.filename,
            mime_type=_mime(entry.filename),
            size_bytes=len(data),
            status="processing",
        )
    )
    await session.commit()
    await storage.put_bytes(object_key, data, _mime(entry.filename))
    await enqueue(INGEST_TASK, str(doc_id), _job_id=f"ingest:{doc_id}")
    return doc_id


async def _reingest(session: AsyncSession, doc_id: str) -> UUID:
    """기존 문서를 다시 인제스트한다. 업로드된 바이트를 재사용한다(01 §3.3)."""
    doc = await session.get(Document, UUID(doc_id))
    doc.status, doc.stage, doc.error = "processing", None, None
    await session.commit()
    await clear_job(f"ingest:{doc_id}")
    await enqueue(INGEST_TASK, doc_id, _job_id=f"ingest:{doc_id}")
    return UUID(doc_id)


async def _wait_ready(session: AsyncSession, doc_ids: list[UUID]) -> dict[str, int]:
    """대상 문서가 모두 ready 또는 failed가 될 때까지 폴링한다."""
    deadline = time.monotonic() + _WAIT_TIMEOUT_S
    while True:
        rows = (
            await session.execute(
                text("SELECT status, count(*) AS c FROM archive.documents "
                     "WHERE id = ANY(:ids) GROUP BY status"),
                {"ids": doc_ids},
            )
        ).mappings().all()
        counts = {r["status"]: r["c"] for r in rows}
        done = counts.get("ready", 0) + counts.get("failed", 0)
        print(f"  적재 진행: ready={counts.get('ready', 0)} "
              f"failed={counts.get('failed', 0)} / {len(doc_ids)}")
        if done >= len(doc_ids) or time.monotonic() > deadline:
            return counts
        await asyncio.sleep(_WAIT_INTERVAL_S)


async def run(*, reingest: bool = False, dry_run: bool = False, limit: int | None = None) -> int:
    """적재 워크플로우 진입점. 0=성공, 1=실패."""
    corpus = schemas.read_corpus()
    cases = schemas.read_cases()

    static_missing = _static_check(corpus, cases)
    if static_missing:
        print(f"케이스 정답이 핀 목록에 없음: {len(static_missing)}")
        for m in static_missing:
            print(f"  {m}")
        return 1

    sha_problems = _verify_sha256(corpus)
    if sha_problems:
        print(f"sha256 검증 실패: {len(sha_problems)}")
        for p in sha_problems:
            print(f"  {p}")
        return 1

    async with eval_session() as session:
        existing = await _existing_sha256(session)
        corpus_shas = {e.sha256 for e in corpus}

        if reingest:
            new_entries = [e for e in corpus if e.sha256 not in existing]
            reingest_ids = [existing[e.sha256] for e in corpus if e.sha256 in existing]
        else:
            new_entries = [e for e in corpus if e.sha256 not in existing]
            reingest_ids = []

        if limit is not None:
            new_entries = new_entries[:limit]

        print(f"corpus {len(corpus)} / 기존 {len(existing)} / 신규 적재 {len(new_entries)} "
              f"/ 재적재 {len(reingest_ids)}")

        if dry_run:
            mapping = await _ready_mapping(session, corpus_shas)
            print(f"[dry-run] 적재 생략. 현재 ready 매핑 {len(mapping)}건.")
            return _resolve_cases(mapping, cases)

        doc_ids = [await _ingest_new(session, e) for e in new_entries]
        doc_ids += [await _reingest(session, i) for i in reingest_ids]
        if doc_ids:
            await _wait_ready(session, doc_ids)

        mapping = await _ready_mapping(session, corpus_shas)
        print(f"sha256 -> document_id 매핑 {len(mapping)}건 산출.")
        return _resolve_cases(mapping, cases)


def _resolve_cases(mapping: dict[str, str], cases: list[schemas.Case]) -> int:
    """케이스 정답을 매핑으로 해소하고 없는 정답에 fail-fast 한다(01 §3.2)."""
    missing: list[str] = []
    for case in cases:
        for did in case.answer_doc_ids:
            if did.rsplit(":", 1)[1] not in mapping:
                missing.append(f"{case.id} -> {did}")
    if missing:
        print(f"정답을 코퍼스에서 찾지 못함: {len(missing)}")
        for m in missing:
            print(f"  {m}")
        return 1
    print("케이스 정답 해소 완료.")
    return 0
