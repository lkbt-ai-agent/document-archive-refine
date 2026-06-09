# 05. 참고자료 & 검증 Caveat

조사일 2026-06-09. 출처는 각 결정의 1차 근거 위주(공식 docs/모델 카드/논문). 분야가 빠르게 변하므로 빌드 시점 재확인 권장 항목을 마지막에 별도 정리.

---

## 텍스트 추출 · OCR
- llama.cpp 멀티모달 지원 매트릭스 — https://github.com/ggml-org/llama.cpp/blob/master/docs/multimodal.md
- ggml-org: Using OCR models with llama.cpp — https://huggingface.co/blog/ggml-org/using-ocr-models-with-llama-cpp
- Qwen2.5-VL-7B GGUF — https://huggingface.co/Mungert/Qwen2.5-VL-7B-Instruct-GGUF
- PaddleOCR 한국어(v5) — https://github.com/PaddlePaddle/PaddleOCR/discussions/15712 · (v4 미지원) https://github.com/PaddlePaddle/PaddleOCR/discussions/14367
- Surya(90+ 언어) — https://github.com/datalab-to/surya
- GOT-OCR2.0 아키텍처 미지원 — https://huggingface.co/stepfun-ai/GOT-OCR2_0/discussions/35
- PyMuPDF4LLM docs — https://pymupdf.readthedocs.io/en/latest/pymupdf4llm/ · OCR 레시피 https://pymupdf.readthedocs.io/en/latest/recipes-ocr.html
- 스캔 PDF 판별 — https://github.com/pymupdf/PyMuPDF/discussions/1653
- PDF 파서 비교(arXiv) — https://arxiv.org/html/2410.09871v1
- charset 감지 비교 — https://bytetunnels.com/posts/charset-detection-python-chardet-cchardet-charset-normalizer/ · chardet UHC 이슈 https://github.com/chardet/chardet/issues/164
- 표 청킹 RAG 효과 — https://tatrasdata.com/portfolio/html-to-markdown-and-table-chunking-achieve-20-rag-accuracy-gain/
- text-extract-api(FastAPI+Celery+OCR 참고구현) — https://github.com/CatchTheTornado/text-extract-api
- PM4Bench(한국어 OCR 수치) — https://arxiv.org/pdf/2503.18484  ⚠️ 단일 출처

## 임베딩 · 청킹 · pgvector
- KURE(Ko-MTEB 리더보드) — https://github.com/nlpai-lab/KURE · 모델 https://huggingface.co/nlpai-lab/KURE-v1 · GGUF https://huggingface.co/Bingsu/KURE-v1-Q8_0-GGUF
- BAAI/bge-m3 — https://bge-model.com/bge/bge_m3.html · GGUF https://huggingface.co/gpustack/bge-m3-GGUF
- bge-m3 sparse llama.cpp 미지원(이슈) — https://github.com/ggml-org/llama.cpp/issues/14404
- Qwen3-Embedding-0.6B GGUF — https://huggingface.co/Qwen/Qwen3-Embedding-0.6B-GGUF
- llama.cpp server README(`--embeddings`/풀링/`/v1/embeddings`/`--reranking`/`--json-schema`) — https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md
- snowflake-arctic batch≥ctx 크래시 — https://huggingface.co/limcheekin/snowflake-arctic-embed-l-v2.0-GGUF/discussions/1
- Anthropic Contextual Retrieval — https://www.anthropic.com/news/contextual-retrieval
- pgvector README(HNSW/halfvec/차원한계) — https://github.com/pgvector/pgvector/blob/master/README.md
- 한국어 분절 토큰 — https://arxiv.org/pdf/2309.03713 · CJK 파이프라인 https://tonybaloney.github.io/posts/cjk-chinese-japanese-korean-llm-ai-best-practices.html
- Chonkie — https://github.com/chonkie-inc/chonkie

## 생성 모델 · llama.cpp 런타임
- SKT A.X 4.0 Light(벤치/Apache 2.0) — https://huggingface.co/skt/A.X-4.0-Light · GGUF https://huggingface.co/mykor/A.X-4.0-Light-gguf
- EXAONE 3.5(repo) — https://github.com/LG-AI-EXAONE/EXAONE-3.5 · **NC 라이선스** https://huggingface.co/LGAI-EXAONE/EXAONE-3.5-32B-Instruct-GGUF · EXAONE 4.0 LICENSE https://huggingface.co/LGAI-EXAONE/EXAONE-4.0-32B/blob/main/LICENSE
- Qwen3/Qwen2.5 — https://github.com/QwenLM/Qwen3 · https://qwenlm.github.io/blog/qwen2.5/ · Gemma 3 https://huggingface.co/blog/gemma3
- 양자화 통합 평가(arXiv) — https://arxiv.org/html/2601.14277v1 · Q4/Q5/Q6/Q8 품질 https://runaihome.com/blog/quantization-q4-q5-q6-q8-quality-loss-2026/
- llama-swap(다중 모델 핫스왑) — https://github.com/mostlygeek/llama-swap
- 다중 모델 메모리 관리 — https://www.sitepoint.com/multiple-local-models-memory-management/
- 인용 강제 프롬프팅 — https://www.mdpi.com/2076-3417/16/6/3013

## 검색 · RAG
- PGroonga vs pg_bigm — https://pgroonga.github.io/reference/pgroonga-versus-pg-bigm.html · vs textsearch/pg_trgm https://pgroonga.github.io/reference/pgroonga-versus-textsearch-and-pg-trgm.html
- PGroonga 4.0 릴리스(다국어 FTS) — https://www.postgresql.org/about/news/pgroonga-400-multilingual-fast-full-text-search-3012/
- Groonga TokenMecab — https://groonga.org/docs/reference/tokenizers/token_mecab.html · TokenBigram https://groonga.org/docs/reference/tokenizers/token_bigram.html
- Supabase 하이브리드 — https://supabase.com/docs/guides/ai/hybrid-search · jkatz pgvector 하이브리드 https://jkatz05.com/post/postgres/hybrid-search-postgres-pgvector/
- ParadeDB 하이브리드(ts_rank vs BM25, RRF) — https://www.paradedb.com/blog/hybrid-search-in-postgresql-the-missing-manual
- bge-reranker-v2-m3 GGUF — https://huggingface.co/gpustack/bge-reranker-v2-m3-GGUF · 한국어 튜닝 https://huggingface.co/dragonkue/bge-reranker-v2-m3-ko · Qwen3-Reranker llama.cpp 수정 https://gist.github.com/VooDisss/42bce4eb5c76d3c325633886c5e348ee
- llama.cpp GBNF grammars — https://github.com/ggml-org/llama.cpp/blob/master/grammars/README.md · 제약 디코딩 https://www.aidancooper.co.uk/constrained-decoding/
- 쿼리에서 메타필터 추출 — https://haystack.deepset.ai/blog/extracting-metadata-filter · Multi-Meta-RAG https://arxiv.org/pdf/2406.13213
- RAG 서베이(naive vs advanced) — https://arxiv.org/pdf/2312.10997 · Neo4j advanced RAG https://neo4j.com/blog/genai/advanced-rag-techniques/
- RAG 평가(Recall@k) — https://www.buildmvpfast.com/blog/rag-evaluation-retrieval-quality-answer-accuracy-2026 · Ragas https://arxiv.org/abs/2309.15217

## AI 산출물 · 계보 · 비동기
- 장문 요약(stuff/map-reduce/refine) — https://cloud.google.com/blog/products/ai-machine-learning/long-document-summarization-with-workflows-and-gemini-models · (KR) https://teddylee777.github.io/langchain/summarize-chain/
- LlamaIndex CitationQueryEngine — https://developers.llamaindex.ai/python/examples/workflow/citation_query_engine/
- Retrieval-and-Structuring 서베이 — https://arxiv.org/pdf/2509.10697
- VegaChat(선언형 차트 오류율) — https://arxiv.org/html/2601.15385v1 · LLM 시각화 평가 https://arxiv.org/pdf/2507.22890 · E2B https://e2b.dev/
- W3C PROV Primer — https://www.w3.org/TR/prov-primer/ · ML 출처(arXiv) https://arxiv.org/pdf/2507.01075 · Atlan LLM lineage https://atlan.com/know/training-data-lineage-for-llms/
- Langfuse 데이터 모델 — https://langfuse.com/docs/observability/data-model · 토큰/비용 https://langfuse.com/docs/observability/features/token-and-cost-tracking
- arq vs BackgroundTasks/Celery — https://davidmuraya.com/blog/fastapi-background-tasks-arq-vs-built-in/ · https://www.bithost.in/blog/tech-3/how-to-run-fastapi-background-tasks-arq-vs-celery-11

## 아키텍처 · 인프라
- 계층 트리(인접리스트/CTE) — https://leonardqmarcq.com/posts/modeling-hierarchical-tree-data · https://www.ackee.agency/blog/hierarchical-models-in-postgresql · SQLAlchemy CTE http://www.jeffwidman.com/blog/827/traversing-a-tree-stored-as-an-adjacency-list-using-a-recursive-cte-built-in-sqlalchemy/
- Next+Postgres+MinIO presigned — https://www.alexefimenko.com/posts/file-storage-nextjs-postgres-s3 · FastAPI+S3 presigned https://dev.to/copubah/how-i-built-a-secure-file-upload-api-using-fastapi-and-aws-s3-presigned-urls-7eg
- FastAPI best practices — https://github.com/zhanymkanov/fastapi-best-practices · async SA2 셋업 https://berkkaraal.com/blog/2024/09/19/setup-fastapi-project-with-async-sqlalchemy-2-alembic-postgresql-and-docker/
- Next 16 서버/클라이언트 — https://nextjs.org/docs/app/getting-started/server-and-client-components
- shadcn Resizable — https://ui.shadcn.com/docs/components/radix/resizable · tree-view https://github.com/MrLightful/shadcn-tree-view · dropzone https://github.com/diragb/shadcn-dropzone
- 로컬 AI Docker Compose — https://markaicode.com/docker-compose-local-ai-stack/ · rag_api(pgvector) https://github.com/danny-avila/rag_api

---

## 빌드 시점 재확인 권장 (Caveat)

1. **PM4Bench 한국어 OCR 수치(7B 77.6% / 72B 94.8%)** — 검색 요약 단일 출처. 인용 전 원논문 표 재확인.
2. **PyMuPDF AGPL-3.0** — 외부 서비스 배포 시 소스 공개 의무 가능. 상업 라이선스 또는 pypdf/pdfplumber 대체 결정 필요.
3. **llama.cpp OCR/멀티모달 지원**은 빠르게 변동. Qwen2-VL/2.5-VL은 공식 확인됐으나 신규 전용 OCR VLM 목록(PaddleOCR-VL "degraded" 등)은 빌드 시 `docs/multimodal.md` 재확인.
4. **KURE-v1 공식 GGUF 부재** — 커뮤니티 `Bingsu/KURE-v1-Q8_0-GGUF` 사용. safetensors 원본 대비 출력 품질 검증 후 확정. 더 안전한 선택은 BAAI/bge-m3.
5. **KURE 리더보드 점수는 저자 자체 벤치** — 방향성은 강하나 제3자 검증은 bge-m3가 더 확실.
6. **PGroonga + pgvector 동일 DB** — 표준 `pgvector/pgvector` 이미지엔 PGroonga 없음. 두 확장 포함 커스텀 이미지 필요(인프라 작업 항목).
7. **EXAONE 비상업** — 상업 배포 시 절대 사용 금지(A.X 4.0 Light로 대체). 본 프로젝트 용도(개인 문서)가 비상업이면 EXAONE도 후보지만 라이선스 문구 재확인.
8. **Anthropic Contextual Retrieval -49%/-67%** 수치는 자사 데이터셋 기준. 한국어 아카이브에선 더 작지만 실재하는 개선 기대.
9. **양자화 평가**는 Llama-3.1-8B 기준. A.X 4.0 Light(7B)에 그대로 적용되나 한국어 품질은 소형 모델일수록 양자화 민감 → 단독 상주는 Q5_K_M, **Mac 24GB에서 3종 동시 운용 시 생성은 Q4_K_M** 권장(→ [00 §0.1](./00-summary-and-decisions.md)).
10. **Apple Silicon + Docker = Metal 불가** — macOS Docker 컨테이너는 Metal GPU에 접근 못 함. **llama-server는 반드시 Mac 호스트에서 네이티브로** 실행하고, Docker의 API는 `host.docker.internal`로 접속(→ [04 §6](./04-architecture.md)). Docker로 llama.cpp를 돌리면 CPU-only로 느려짐.
11. **Mac 24GB 메모리 예산** — macOS(~3–4GB) 제외 후 생성(Q4 ~4.9GB)+임베딩(~1GB) 상주, OCR VLM(~6GB)은 `llama-swap` 온디맨드. 실제 KV 캐시 사용량은 컨텍스트 길이·동시요청에 따라 변하니 부하 테스트로 확인.
12. **Provider 전환 시 임베딩 잠금(lock-in)** — 생성(LLM) Provider는 쉽게 로컬↔Bedrock 교체 가능하나, **임베딩 Provider를 바꾸면 차원·의미 공간이 달라져 기존 벡터 전부 재생성** 필요. 임베딩은 KURE-v1 로컬 고정 권장(→ [04 §0](./04-architecture.md)).
13. **AWS Bedrock은 "추후" 옵션** — MVP는 로컬 llama.cpp 기준. Bedrock의 모델 가용 목록·리전·가격은 변동하니 실제 전환 시점에 Bedrock 콘솔/문서로 모델 ID·리전·요금 재확인. 계보 `provider`/`models`에 클라우드 모델 ID·리전 기록.

### 하드웨어 · Provider 참고
- llama.cpp Metal(Apple GPU) 빌드/실행 — https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md
- llama-swap(다중 모델 온디맨드 스왑) — https://github.com/mostlygeek/llama-swap
- Docker Desktop for Mac에서 GPU(Metal) 미지원 — https://docs.docker.com/desktop/features/gpu/ (Linux 한정) · `host.docker.internal` https://docs.docker.com/desktop/features/networking/
- AWS Bedrock 개요·모델 — https://docs.aws.amazon.com/bedrock/latest/userguide/what-is-bedrock.html
