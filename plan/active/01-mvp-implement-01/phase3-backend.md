---
created: 2026-06-11
completed: —
overview: 백엔드 구현 — 기반·데이터모델·Provider·폴더·스토리지·인제스트·검색/RAG·산출물 (arch 03~09).
---

## 기반 (arch 04)
- [ ] 3.1 모듈 스캐폴드 — `backend/src/{main,config,database,models}` + 도메인 패키지 (§4).
- [ ] 3.2 설정 — pydantic-settings `.env` 로드, 환경별 분리 (§7).
- [ ] 3.3 DB 와이어링 — async engine/sessionmaker, `get_session`, `expire_on_commit=False` (§6).
- [ ] 3.4 공통 규약 — 에러 모델/핸들러, 페이지네이션, CORS, `owner_id` 스코프 강제 (§8).

## 데이터 모델 (arch 03)
- [ ] 3.5 SQLAlchemy 모델 — Base, folders/documents/document_chunks/계보 (§5·§6).
- [ ] 3.6 Alembic(`-t async`) 초기화, `version_table_schema='archive'` (§8).
- [ ] 3.7 수동 마이그레이션 — 확장·ENUM·HNSW·PGroonga 인덱스 (§8).
- [ ] 3.8 `alembic upgrade head` 원격 적용 + `users` 시드 1명 (§3).

## AI Provider (arch 04 §9·§10)
- [ ] 3.9 `LLMClient`/`EmbeddingClient` Protocol + 팩토리(`LLM_PROVIDER`).
- [ ] 3.10 `LlamaCppLLM`/`LlamaCppEmbedding` 구현(KURE-v1 로컬 고정).
- [ ] 3.11 GBNF `--json-schema` 구조화 출력 공통 래퍼.

## 폴더 (arch 05)
- [ ] 3.12 트리 조회(재귀 CTE 평면 리스트) + CRUD.
- [ ] 3.13 MOVE + 사이클 방지(후손 검증), 형제 중복명 409.
- [ ] 3.14 재귀 삭제 — `object_key` 수집 → DB CASCADE → worker MinIO 삭제.

## 스토리지 (arch 06)
- [ ] 3.15 MinIO 클라이언트(`secure=False`, 버킷 보장).
- [ ] 3.16 업로드 3단계 — Init(presigned PUT)/Upload/Confirm(`stat_object` 검증).
- [ ] 3.17 다운로드 presigned GET(RFC 5987 한글명) + 발급 전 `owner_id` 검사.
- [ ] 3.18 삭제 수명주기(멱등) + presign TTL 단축(5~15분) (§10).

## 인제스트 (arch 07)
- [ ] 3.19 arq worker + enqueue, status/stage 멱등 갱신.
- [ ] 3.20 파일타입 감지(magic bytes) → PDF 추출(pypdf + pdfplumber 표).
- [ ] 3.21 OCR — PaddleOCR → Tesseract(kor) 폴백, 페이지 단위 부분실패 격리.
- [ ] 3.22 TXT/MD 처리(EUC-KR→CP949 안전 디코딩, MD 구조 보존).
- [ ] 3.23 메타 생성(intrinsic + NLP + LLM `{title,summary,topics,keywords}`).
- [ ] 3.24 청킹(512/64) + KURE-v1 임베딩(1024d) → `document_chunks` upsert.

## 검색 & RAG (arch 08)
- [ ] 3.25 키워드 검색(PGroonga `&@~`, 폴백 tsvector).
- [ ] 3.26 의미 검색(HNSW cosine) + `hybrid_search` RRF(k=50) 단일 SQL.
- [ ] 3.27 자연어→구조화 질의(GBNF) + Python 날짜 해석, `owner_id` 강제.
- [ ] 3.28 RAG — 컨텍스트 조립 + 인용 강제 생성(`[n]↔chunk_id`), `/search`·`/search/ask`.

## AI 산출물 & 계보 (arch 09)
- [ ] 3.30 비동기 생성 — `POST /generations`(202) + `generations(queued)` + enqueue.
- [ ] 3.31 Summary(STUFF/MAP-REDUCE/HIERARCHICAL) 워크플로우.
- [ ] 3.32 Draft(outline-then-expand) 워크플로우.
- [ ] 3.33 Report — Python 통계 + Vega-Lite 스펙 + 검증·수리 루프(≤5).
- [ ] 3.34 계보 기록(provider/model/seed/프롬프트/출처/차트) + `/generations/{id}`·`/lineage`.
