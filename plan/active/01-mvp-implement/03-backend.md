---
created: 2026-06-11
completed: 2026-06-18
overview: 백엔드 구현 — 기반·데이터모델·Provider·폴더·스토리지·인제스트·검색/RAG·산출물 (arch data-overview·backend·domains 전반).
---

> 라이브러리·툴 버전·API 상세는 context7 MCP로 확인.

## 기반 (backend)
- [x] A1 모듈 스캐폴드 — `src/{main,config,database,models}` + 도메인 패키지 (§3).
- [x] A2 설정 — pydantic-settings `.env`, 환경 분리 (§6).
- [x] A3 DB 와이어링 — async engine/sessionmaker, `get_session`, `expire_on_commit=False` (§5).
- [x] A4 공통 규약 — 에러 모델/핸들러·페이지네이션·CORS·`owner_id` 스코프 (§7).
- [x] A5 기동 헬스체크 — PG/MinIO fail-fast, Redis/llama 점검 (§11).

## 데이터 모델 (data-overview)
- [x] B1 SQLAlchemy 모델 10종 — users·folders·documents·document_chunks·generations(+prompts/source_documents/source_chunks/charts)·models, Base·명명규약 (§1·§2, schema 문서들).
- [x] B2 Alembic `init -t async` + `version_table_schema='archive'` (§4).
- [x] B3 수동 마이그레이션 — 확장 가드(`IF NOT EXISTS`, 02-infra 선설치)·ENUM 5종·HNSW·PGroonga·gin (§3·§4).
- [x] B4 원격 `upgrade head` + 시드(users 1·models 2) (§4, users-schema, generations-schema §1).

## AI Provider (backend §8·§9)
- [x] C1 `LLMClient`/`EmbeddingClient` Protocol + 팩토리(`LLM_PROVIDER`/`EMBEDDING_PROVIDER`).
- [x] C2 `LlamaCppLLM`/`LlamaCppEmbedding`(KURE-v1 고정, 1024d).
- [x] C3 GBNF `--json-schema` 구조화 출력 래퍼.
- [x] C4 `BedrockLLM` 인터페이스 스텁(실구현 제외) (system-overview §1, backend §8·§12).

## 폴더 (folders)
- [x] D1 트리(재귀 CTE) + CRUD (folders-backend §1·§2).
- [x] D2 MOVE 사이클 방지(422)·형제 중복명(409) (folders.md §5, folders-backend §1).
- [x] D3 재귀 삭제 — `object_key` 수집 → CASCADE → MinIO 위임 (folders-backend §2).

## 스토리지 (document)
- [x] E1 MinIO 클라이언트(`secure=False`), 버킷은 02-infra 보장 (document-backend §3).
- [x] E2 업로드 3단계 — init(`docs/{uuid}`·presigned PUT)/upload/confirm(`stat_object`) (document-backend §2·§3, documents-minio §1).
- [x] E3 다운로드 presigned GET(RFC 5987) + `owner_id` 검사 (document-backend §3).
- [x] E4 삭제 수명주기(멱등) + presign TTL 5~15분 (document-backend §3·§4).
- [x] E5 고아 정리 잡 — 24h `uploaded` + `stat_object` 부재 시 삭제 (document-backend §4).
- [x] E6 조회·이동 API — 목록(`folder_id`·cursor)·상세·`PATCH` 이동 (document-backend §1).

## 인제스트 (ingestion)
- [x] F1 arq worker·enqueue, `status`/`stage` 멱등, `ingest_ms` (§2·§4).
- [x] F2 파일타입 감지(내용 기반) + PDF 본문·표 (§3-1·§3-2).
- [x] F3 OCR(스캔·이미지) 페이지 단위·부분 실패 격리 (§3-2).
- [x] F4 TXT/MD 안전 디코딩·구조 보존 (§3-2).
- [x] F5 메타 `{title,summary,topics,keywords}` + intrinsic·언어 (§3-3).
- [x] F6 청킹 + KURE-v1 임베딩 → `document_chunks` 멱등 upsert (§3-4·§3-5).
- [x] F7 `sha256` 인제스트 중 계산·동일 파일 식별(차단 안 함) (document-backend §5, documents-schema §3, document.md §4).
- 추출/OCR 엔진은 ingestion-backend §2-2, 라이브러리 API·버전만 context7.

## 검색 & RAG (search-and-rag)
- [x] G1 키워드(PGroonga, 폴백 `tsvector simple`) (search-backend §3, search-schema §1).
- [x] G2 의미(HNSW cosine) (search-backend §3, search-schema §2).
- [x] G3 질의 파싱(GBNF) + Python 날짜·`owner_id` 강제 (search-backend §2, search-and-rag §3).
- [x] G4 단일 진입 — `POST /search`·`/search/ask`(인용 `[n]↔chunk_id`) (search-backend §1·§2).
- [x] G5 평가 게이트 — Recall@5/@20 + 인용 이진 체크, CI (search-backend §6, search-and-rag §7).

## AI 산출물 & 계보 (ai-outputs)
- [x] H1 비동기 생성 — `POST /generations`(202)·queued·enqueue (ai-outputs-backend §2).
- [x] H2 Summary(STUFF/MAP-REDUCE/HIERARCHICAL) (ai-outputs-backend §3).
- [x] H3 Draft(outline-expand) (ai-outputs-backend §4).
- [x] H4 Report — Python 통계 + Vega-Lite + 수리 루프(≤5) (ai-outputs-backend §5).
- [x] H5 계보 스냅샷(provider/model/seed/프롬프트/출처청크 `cited_text`·`cited_title`) + `/generations/{id}`·`/lineage`·내역 목록(`?source_document_id`, 출력 문서 존재 건만) (ai-outputs-backend §6·§1, generations-schema §2).
- [x] H6 산출물 문서화 — 업로드 + `documents` + 인제스트, `output_document_id` (ai-outputs-backend §7).

## 아키텍처 반영 계획 (구현 중 확정·변경)
> 구현 중 확정·변경한 사항을 `architecture/`에 반영한다. architecture/CLAUDE.md 준수(`## n.` 재번호 금지·append·상위 레이어만 참조).

- [x] R1 ingestion-backend §2-2 — 백엔드는 스캔 페이지를 pdf2image 풀페이지 렌더(200 DPI)로만 OCR하므로, "임베디드 이미지 추출은 추후" 단서를 §2-2에 추가한다.
- [x] R2 ingestion-backend §2-4 — 청킹은 토큰 수를 llama-server `/tokenize`로 측정하고 라인 경계에서만 분할해 표 행을 보존하므로, 이 방식을 §2-4에 명시한다.
- [x] R3 ai-outputs §5·ai-outputs-backend §5 — 보고서 파이프라인은 통계를 결정적으로 `data.values`에 주입하고 수리 5회 실패 시 결정적 폴백 차트를 유지하므로, "차트 폐기·제외"를 "폴백 유지(추출 행 0개일 때만 생략)"로 갱신한다.
- [x] R4 generations-schema §1·data-erd — 프롬프트 템플릿 기능이 도메인에 없어 `prompt_templates`가 고아 테이블이므로, arch·코드·DB에서 제거했다(스냅샷은 `rendered_prompt`로 유지).
- [x] ~~R5 users-schema §2~~ — owner_id 고정은 인증 미구현 탓이고 §2가 이미 명시하므로, 별도 반영 없이 철회한다.
- [x] R6 backend §7 — API는 에러를 `{"error":{code,message,details}}`로 직렬화하고 문서 목록을 keyset cursor(base64 `(created_at,id)`)로 페이지네이션하므로, 두 계약을 §7에 명시한다.
- [x] R7 backend §11 — 앱은 `GET /health`로 의존성별 상태를 반환하므로, 이 런타임 점검 엔드포인트를 §11에 추가한다.
- [x] R8 backend §3 — 백엔드는 uv·Python 3.12로 패키지 `src`를 실행하므로(워커 `arq src.pipeline.worker.WorkerSettings`), 런타임/툴체인을 §3에 추가한다.
- [x] R9 backend §9 — 구조화 출력 래퍼는 llama-server에 `response_format:{type:"json_schema"}`로 GBNF를 강제하므로, 호출 방식을 §9에 명시한다.
