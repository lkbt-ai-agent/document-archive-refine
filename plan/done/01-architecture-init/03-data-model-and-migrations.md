# 03. 데이터 모델 & 마이그레이션 아키텍처 — 작성 플랜

> **산출물:** `architecture/03-data-model-and-migrations.md`
> **상태:** ⬜ Not started
> **근거 research:** `research/04 §1·§4b`, `research/01 §5.4`, `research/03 §4`
> **선행:** 02-infrastructure-and-environment

## 목적
전체 DB 스키마(폴더·문서·청크·계보)와 Alembic 마이그레이션 전략을 하나로 통합 정의한다. 원격 공유 DB·확장 제약을 반영한다.

## 지켜야 할 제약
- 원격 `mirimiri` DB에 적용 → **전용 스키마/접두어**로 격리(02 §4와 정합).
- `pgvector`·`PGroonga` 확장 의존 → 미가용 시 영향과 폴백 명시.
- 마이그레이션은 원격 DB를 대상으로 실행(로컬 DB 가정 금지).

## 작성 단계 (= 아키텍처 문서 섹션)
- [x] S1. **ER 다이어그램** — `users`(전제), `folders`, `documents`, `document_chunks`, `generations` + 하위(`generation_prompts`, `generation_source_documents`, `generation_source_chunks`, `generation_charts`), `models`, `prompt_templates`.
- [x] S2. **`folders` 테이블** — 인접 리스트(`parent_id` self-FK, `ON DELETE CASCADE`), `owner_id`, 형제 유니크(`uq_folder_sibling_name`), `ix_folders_parent_id`. (상세 동작은 05 문서.)
- [x] S3. **`documents` 테이블** — 스토리지(`object_key` UNIQUE, `bucket`, `original_filename`, `mime_type`, `size_bytes`, `sha256`), 파이프라인(`status`, `stage`, `error`), 내재 메타(`page_count`,`author`,`language`,`doc_created_at/modified_at`), LLM 메타(`llm_title`,`llm_summary`,`topics[]`,`keywords[]`), `content`(PGroonga 대상), 인덱스.
- [x] S4. **`document_chunks` 테이블** — `vector(1024)`, `content`, `context`, `metadata jsonb`, `parent_doc_id`, `chunk_index` 유니크, **HNSW**(`vector_cosine_ops`, `m=16, ef_construction=200`) + GIN(metadata). (상세는 07/08.)
- [x] S5. **계보 스키마** — `models`, `prompt_templates`, `generations`(디코딩 파라미터·seed·토큰·provider 스냅샷), `generation_prompts`, `generation_source_documents`, `generation_source_chunks`, `generation_charts`. ENUM(`artifact_kind`,`gen_method`,`job_status`). (상세는 09.)
- [x] S6. **명명 규약 & Base** — SQLAlchemy `MetaData(naming_convention=...)`, `Mapped[]`+`mapped_column()`, Pydantic v2 `from_attributes=True`, 상태 `Literal[...]`.
- [x] S7. **확장 의존 & 격리** — `CREATE EXTENSION vector/pgroonga`, 전용 스키마 적용, `search_path` 또는 스키마 한정 테이블명. 확장 미가용 시 영향 표.
- [x] S8. **Alembic 전략** — `alembic init -t async`, `target_metadata=Base.metadata`, 모든 모델 import, 확장/인덱스(HNSW·PGroonga)는 수동 마이그레이션 작성, 원격 DB 대상 실행 절차·롤백.
- [x] S9. **데이터 무결성·삭제 정책** — CASCADE 경로(folder→documents→chunks→generation 참조), 문서 삭제 시 MinIO 오브젝트·청크·계보 정리 규칙(06/09와 정합).

## 캡처할 핵심 결정 (research)
- 차원 **1024** 전 시스템 통일, HNSW cosine.
- 계보는 W3C PROV/Langfuse 정렬, 행 단위 스냅샷(모델/템플릿 변경이 과거 기록 미오염).

## 다이어그램
- [x] `erDiagram`(Mermaid) 전체 관계.
- [x] 삭제 CASCADE 흐름.

## 제약·리스크·오픈 이슈
- [x] **`users` 테이블 출처** — 인증 모듈이 별도인지, 본 설계에서 정의하는지 결정.
- [x] **공유 DB 충돌** — 전용 스키마 미사용 시 테이블명 충돌 가능.
- [x] **HNSW 빌드 비용** — 원격 DB 리소스 한계 확인.
- [x] **PGroonga 인덱스 대상** — `documents.content`(문서 단위) vs 청크 단위 결정(08과 정합).

## 완료 기준
- [x] `architecture/03-*.md` 존재, S1~S9 충족.
- [x] 모든 테이블 DDL이 원격/공유 DB 격리 전략을 반영.
- [x] 확장·마이그레이션 절차가 원격 대상으로 기술됨.
