# 04. 백엔드 애플리케이션 구조 & Provider 추상화 — 작성 플랜

> **산출물:** `architecture/04-backend-application.md`
> **상태:** ⬜ Not started
> **근거 research:** `research/04 §0·§3`, `research/00 §0.2`
> **선행:** 02-infrastructure, 03-data-model

## 목적

FastAPI 도메인 모듈 구조, 레이어링, 비동기 SQLAlchemy 와이어링, API 공통 규약, **AI Provider 추상화**(LLM/Embedding 클라이언트)를 정의한다.

## 지켜야 할 제약

- DB·스토리지 클라이언트는 **원격 연결 설정**(02)을 주입받는다.
- Provider 추상화로 로컬 llama.cpp ↔ 추후 Bedrock 교체 가능. 임베딩 Provider는 **로컬 고정 권장**(차원 lock-in).

## 작성 단계 (= 아키텍처 문서 섹션)

- S1. **모듈 구조** — `src/{main,config,database,models}` + 도메인 패키지 `folders/ documents/ search/ generations/ storage/ pipeline/`. 각 패키지 `{router,schemas,models,service,repository,exceptions}`.
- S2. **레이어링 규약** — router → service → repository → model. Pydantic 스키마 ↔ ORM 분리. SQL 우선(조인/집계/트리), CPU 작업은 worker로.
- S3. **DB 세션 관리** — async engine/sessionmaker, `get_session` 의존성, 트랜잭션 경계, `expire_on_commit=False`.
- S4. **설정/구성** — pydantic-settings로 `.env` 로드, 원격 PG/MinIO/Redis/llama URL 주입, 환경별 분리.
- S5. **API 공통 규약** — 라우트 네이밍, 페이지네이션, 에러 모델/예외 핸들러, `owner_id` 스코프 강제(보안), 상태코드, CORS.
- S6. **AI Provider 추상화** — `LLMClient`/`EmbeddingClient` Protocol, 구현체(`LlamaCppLLM`, `LlamaCppEmbedding`, 추후 `BedrockLLM`), 설정 기반 선택(`LLM_PROVIDER`/`EMBEDDING_PROVIDER`). 계보에 provider/model 기록 연동(09).
- S7. **구조화 출력** — llama.cpp `--json-schema`(GBNF) 호출 래퍼(메타 추출·쿼리 파싱·차트 스펙 공통 사용).
- S8. **비동기 작업 연동** — arq enqueue 인터페이스, 작업 상태 조회 API, 멱등 키 전략(07/09와 정합).
- S9. **공통 횡단** — 로깅/관측(토큰·지연), 헬스체크(원격 DB/MinIO/Redis/llama 연결 점검).

## 캡처할 핵심 결정 (research)

- 도메인 모듈(`fastapi-best-practices`) + async SA2.
- Provider 추상화 인터페이스 코드(§0) 재사용.

## 다이어그램

- 레이어 다이어그램(router→service→repository→DB/외부).
- Provider 추상화 클래스 관계(Mermaid classDiagram).

## 제약·리스크·오픈 이슈

- **드라이버 일관성** — 03/02의 psycopg3 결정과 engine 설정 일치.
- **헬스체크 대상** — 원격 PG/MinIO 도달 실패 시 기동 정책(fail-fast vs degraded).
- **Bedrock 전환 경계** — MVP는 인터페이스만, 구현은 추후.

## 완료 기준

- `architecture/04-*.md` 존재, S1~S9 충족.
- Provider 추상화 인터페이스·선택 메커니즘 명시.
- DB/스토리지/큐/모델 모든 외부 의존이 설정 주입(원격) 기준으로 기술.

