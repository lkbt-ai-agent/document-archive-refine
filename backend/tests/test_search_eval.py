"""검색 평가 게이트 (search-backend §6, search-and-rag §7).

한국어 골든셋으로 키워드·의미 검색의 Recall@5/@20을 측정하고 RAG 답변의 인용 존재를
이진 체크한다. 원격 PG·MinIO·llama가 필요한 통합 테스트(CI에서 결정적 실행).
실행: `uv run pytest tests/test_search_eval.py -v`
"""

import json
from pathlib import Path

import httpx
import pytest
from httpx import ASGITransport

from src.ingestion.pipeline import run_ingest
from src.main import app
from src.search.eval import citation_present, recall_at_k
from src.search.schemas import AskResponse, SearchResultItem

GOLDEN = json.loads((Path(__file__).parent / "golden_set.json").read_text(encoding="utf-8"))
RECALL5_MIN = 0.8  # 키워드·의미 Recall@5 최소 게이트


async def _ingest_corpus(client: httpx.AsyncClient) -> dict[str, str]:
    name_to_id: dict[str, str] = {}
    for name, body in GOLDEN["corpus"].items():
        r = await client.post("/documents", json={"original_filename": name, "mime_type": "text/plain"})
        j = r.json()
        async with httpx.AsyncClient() as raw:
            await raw.put(j["upload_url"], content=body.encode())
        await client.post(f"/documents/{j['document_id']}/complete")
        await run_ingest(j["document_id"])
        name_to_id[name] = j["document_id"]
    return name_to_id


@pytest.mark.asyncio
async def test_search_eval_gate() -> None:
    transport = ASGITransport(app=app)
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=transport, base_url="http://t", timeout=180) as c:
            name_to_id = await _ingest_corpus(c)
            try:
                # 검색 Recall@5
                recalls = []
                for case in GOLDEN["queries"]:
                    resp = await c.post(
                        "/search", json={"q": case["q"], "mode": case["mode"], "limit": 20}
                    )
                    items = [SearchResultItem(**i) for i in resp.json()["results"]]
                    relevant = {name_to_id[n] for n in case["relevant"]}
                    relevant_uuid = {__import__("uuid").UUID(x) for x in relevant}
                    r5 = recall_at_k(items, relevant_uuid, 5)
                    recalls.append(r5)
                    assert r5 >= RECALL5_MIN, f"Recall@5 미달: {case['q']} = {r5}"
                assert sum(recalls) / len(recalls) >= RECALL5_MIN

                # RAG 인용 존재 이진 체크
                for case in GOLDEN["ask"]:
                    resp = await c.post("/search/ask", json={"q": case["q"], "k": 5})
                    ask = AskResponse(**resp.json())
                    assert citation_present(ask), f"인용 없음: {case['q']}"
            finally:
                for did in name_to_id.values():
                    await c.delete(f"/documents/{did}")
