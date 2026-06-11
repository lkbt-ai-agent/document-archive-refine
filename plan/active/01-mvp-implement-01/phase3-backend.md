---
created: 2026-06-11
completed: —
overview: 백엔드 구현 — 기반·데이터모델·Provider·폴더·스토리지·인제스트·검색/RAG·산출물 (arch data-model·backend-application·domains 전반).
---

## 기반 (backend-application)
- [ ] A1 모듈 스캐폴드 — `backend/src/{main,config,database,models}` + 도메인 패키지 (§3).
- [ ] A2 설정 — pydantic-settings `.env` 로드, 환경별 분리 (§6).
- [ ] A3 DB 와이어링 — async engine/sessionmaker, `get_session`, `expire_on_commit=False` (§5).
- [ ] A4 공통 규약 — 에러 모델/핸들러, 페이지네이션, CORS, `owner_id` 스코프 강제 (§7).

## 데이터 모델 (data-model)
- [ ] B1 SQLAlchemy 모델 — Base, folders/documents/document_chunks/계보 (§4·§5).
- [ ] B2 Alembic(`-t async`) 초기화, `version_table_schema='archive'` (§7).
- [ ] B3 수동 마이그레이션 — 확장·ENUM·HNSW·PGroonga 인덱스 (§7).
- [ ] B4 `alembic upgrade head` 원격 적용 + `users` 시드 1명 (§2).

## AI Provider (backend-application §8·§9)
- [ ] C1 `LLMClient`/`EmbeddingClient` Protocol + 팩토리(`LLM_PROVIDER`).
- [ ] C2 `LlamaCppLLM`/`LlamaCppEmbedding` 구현(KURE-v1 로컬 고정).
- [ ] C3 GBNF `--json-schema` 구조화 출력 공통 래퍼.

## 폴더 (folders)
- [ ] D1 트리 조회(재귀 CTE 평면 리스트) + CRUD.
- [ ] D2 MOVE + 사이클 방지(후손 검증), 형제 중복명 409.
- [ ] D3 재귀 삭제 — `object_key` 수집 → DB CASCADE → worker MinIO 삭제.

## 스토리지 (document-storage)
- [ ] E1 MinIO 클라이언트(`secure=False`) 구성 — 버킷은 phase2 A4에서 보장.
- [ ] E2 업로드 3단계 — Init(presigned PUT)/Upload/Confirm(`stat_object` 검증).
- [ ] E3 다운로드 presigned GET(RFC 5987 한글명) + 발급 전 `owner_id` 검사.
- [ ] E4 삭제 수명주기(멱등) + presign TTL 단축(5~15분) (§9).

## 인제스트 (ingestion)
- [ ] F1 arq worker + enqueue, status/stage 멱등 갱신.
- [ ] F2 파일타입 감지(magic bytes) → PDF 추출(pypdf + pdfplumber 표).
- [ ] F3 OCR — PaddleOCR → Tesseract(kor) 폴백, 페이지 단위 부분실패 격리.
- [ ] F4 TXT/MD 처리(EUC-KR→CP949 안전 디코딩, MD 구조 보존).
- [ ] F5 메타 생성(intrinsic + NLP + LLM `{title,summary,topics,keywords}`).
- [ ] F6 청킹(512/64) + KURE-v1 임베딩(1024d) → `document_chunks` upsert.

## 검색 & RAG (search-and-rag)
- [ ] G1 키워드 검색(PGroonga `&@~`, 폴백 tsvector).
- [ ] G2 의미 검색(HNSW cosine) + `hybrid_search` RRF(k=50) 단일 SQL.
- [ ] G3 자연어→구조화 질의(GBNF) + Python 날짜 해석, `owner_id` 강제.
- [ ] G4 RAG — 컨텍스트 조립 + 인용 강제 생성(`[n]↔chunk_id`), `/search`·`/search/ask`.

## AI 산출물 & 계보 (ai-outputs)
- [ ] H1 비동기 생성 — `POST /generations`(202) + `generations(queued)` + enqueue.
- [ ] H2 Summary(STUFF/MAP-REDUCE/HIERARCHICAL) 워크플로우.
- [ ] H3 Draft(outline-then-expand) 워크플로우.
- [ ] H4 Report — Python 통계 + Vega-Lite 스펙 + 검증·수리 루프(≤5).
- [ ] H5 계보 기록(provider/model/seed/프롬프트/출처/차트) + `/generations/{id}`·`/lineage`.
