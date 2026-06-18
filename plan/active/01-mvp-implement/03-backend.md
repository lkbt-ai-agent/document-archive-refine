---
created: 2026-06-11
completed: 2026-06-18
overview: 백엔드 구현 — 기반·데이터모델·Provider·폴더·스토리지·인제스트·검색/RAG·산출물 (arch data-overview·backend·domains 전반).
---

> 라이브러리·툴 버전·API 상세는 context7 MCP로 확인.

## 기반 (backend)
- [x] A1 모듈 스캐폴드 — `backend/src/{main,config,database,models}` + 도메인 패키지 (§3).
- [x] A2 설정 — pydantic-settings `.env` 로드, 환경별 분리 (§6).
- [x] A3 DB 와이어링 — async engine/sessionmaker, `get_session`, `expire_on_commit=False` (§5).
- [x] A4 공통 규약 — 에러 모델/핸들러, 페이지네이션, CORS, `owner_id` 스코프 강제 (§7).
- [x] A5 기동 헬스체크 — PG/MinIO 도달 실패 시 fail-fast, Redis/llama 점검 (§11).

## 데이터 모델 (data-overview)
- [x] B1 SQLAlchemy 모델 — Base·명명규약 + folders/documents/document_chunks/users + generations·generation_{prompts,source_documents,source_chunks,charts}·models·prompt_templates (§1·§2, schema 문서들).
- [x] B2 Alembic `init -t async` + `version_table_schema='archive'` (§4).
- [x] B3 수동 마이그레이션 — 확장 가용성 확인(`archive_ext`는 02-infra 선설치, `CREATE EXTENSION IF NOT EXISTS` 가드)·ENUM(5종)·HNSW·PGroonga·gin(metadata) 인덱스 (§3·§4).
- [x] B4 `alembic upgrade head` 원격 적용 + `users` 시드 1명 + `models`·`prompt_templates` 레지스트리 시드 (§4, users-schema, generations-schema §1).

## AI Provider (backend §8·§9)
- [x] C1 `LLMClient`/`EmbeddingClient` Protocol + 팩토리(`LLM_PROVIDER`/`EMBEDDING_PROVIDER`).
- [x] C2 `LlamaCppLLM`/`LlamaCppEmbedding` 구현(KURE-v1 로컬 고정, 1024d).
- [x] C3 GBNF `--json-schema` 구조화 출력 공통 래퍼.
- [x] C4 `BedrockLLM` 인터페이스 스텁만 — `LLMClient` 준수, 실구현 제외 (system-overview §1, backend §8·§12).

## 폴더 (folders)
- [x] D1 트리 조회(재귀 CTE 평면 리스트) + CRUD (folders-backend §1·§2).
- [x] D2 MOVE + 사이클 방지(후손 검증, 422), 형제 중복명 409 (folders.md §5, folders-backend §1).
- [x] D3 재귀 삭제 — `object_key` 수집 → DB CASCADE → MinIO 삭제 위임 (folders-backend §2).

## 스토리지 (document)
- [x] E1 MinIO 클라이언트(`secure=False`) 구성 — 버킷은 02-infra A4에서 보장 (document-backend §3).
- [x] E2 업로드 3단계 — init(`object_key=docs/{uuid}` 생성·presigned PUT)/upload/confirm(`stat_object` 검증) (document-backend §2·§3, documents-minio §1).
- [x] E3 다운로드 presigned GET(RFC 5987 한글명) + 발급 전 `owner_id` 검사 (document-backend §3).
- [x] E4 삭제 수명주기(멱등) + presign TTL 5~15분 (document-backend §3·§4).
- [x] E5 고아 정리 잡 — 24h 초과 `uploaded` 행 `stat_object` 부재 확인 후 삭제 (document-backend §4).
- [x] E6 문서 조회·이동 API — 목록(`folder_id`·cursor)·상세(`status`/`stage`/`error`)·폴더 이동(`PATCH {folder_id}`) (document-backend §1).

## 인제스트 (ingestion)
- [x] F1 arq worker + enqueue, `status`/`stage` 멱등 갱신, `ingest_ms` 기록 (§2·§4).
- [x] F2 파일타입 감지(내용 기반) → PDF 본문·표 추출 (§3-1·§3-2).
- [x] F3 OCR(스캔 PDF·이미지) 페이지 단위 + 부분 실패 격리 (§3-2).
- [x] F4 TXT/MD 안전 디코딩 + MD 구조 보존 (§3-2).
- [x] F5 메타 생성 `{title,summary,topics,keywords}` + intrinsic·언어 (§3-3).
- [x] F6 청킹 + KURE-v1 임베딩(1024d) → `document_chunks` 멱등 upsert(`ON CONFLICT (document_id, chunk_index)`) (§3-4·§3-5).
- [x] F7 `sha256` 인제스트 중 계산·`documents` 채움 + 동일 파일 식별·표시(재업로드 차단 안 함) (document-backend §5, documents-schema §3, document.md §4).
- 추출/OCR 엔진 선정은 ingestion-backend §2-2 확정값을 따르고, 라이브러리 API·버전만 context7 MCP로 확인.

## 검색 & RAG (search-and-rag)
- [x] G1 키워드 검색(PGroonga, 폴백 `tsvector simple`) (search-backend §3, search-schema §1).
- [x] G2 의미 검색(HNSW cosine) (search-backend §3, search-schema §2).
- [x] G3 자연어→구조화 질의(GBNF) + Python 날짜 해석, `owner_id` 강제 (search-backend §2, search-and-rag §3).
- [x] G4 단일 진입 라우팅 — 키워드/의미 `POST /search`, rag `POST /search/ask`(인용 `[n]↔chunk_id`) (search-backend §1·§2).
- [x] G5 평가 게이트 — 한국어 골든셋 Recall@5/@20(키워드·의미) + RAG 인용 존재 이진 체크, CI 결정적 (search-backend §6, search-and-rag §7).

## AI 산출물 & 계보 (ai-outputs)
- [x] H1 비동기 생성 — `POST /generations`(202) + `generations(queued)` + enqueue (ai-outputs-backend §2).
- [x] H2 Summary(STUFF/MAP-REDUCE/HIERARCHICAL) 워크플로우 (ai-outputs-backend §3).
- [x] H3 Draft(outline-then-expand) 워크플로우 (ai-outputs-backend §4).
- [x] H4 Report — Python 통계 + Vega-Lite 스펙 + 검증·수리 루프(≤5) (ai-outputs-backend §5).
- [x] H5 계보 기록(provider/model/seed/프롬프트/출처/차트) + 인용 스냅샷(`cited_text`/`cited_title`) 복사·출처 FK `ON DELETE SET NULL` + `/generations/{id}`·`/lineage`·`/generations?source_document_id=&kind=&user=`("산출물 내역", 출력 문서 존재 건만) (ai-outputs-backend §6·§1, generations-schema §2).
- [x] H6 산출물 문서화 — 성공 시 업로드 + `documents` 행 + 인제스트, `output_document_id` 기록 (ai-outputs-backend §7).
