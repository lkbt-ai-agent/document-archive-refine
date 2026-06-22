---
created: 2026-06-11
updated: 2026-06-15
status: approved
overview: 백엔드 공통 구조·레이어링·세션·API 규약·AI Provider 추상화를 정의한다.
refs: docs/research/01-mvp-research/04 §0·§3, docs/research/01-mvp-research/00 §0.2
---

# 백엔드 공통 구조 & Provider 추상화

## 1. 범위

- 도메인 비종속 공통(구조, 레이어, 세션, API 규약, Provider 추상화)을 정의한다.
- 도메인별 API와 흐름은 각 도메인 `*-backend.md`.

## 2. 설계 결정

- 도메인 모듈(`fastapi-best-practices`) + async SQLAlchemy 2(psycopg3).
- Provider 추상화: 비즈니스 로직은 추상 인터페이스에만 의존. 임베딩 Provider는 로컬 고정(차원 lock-in).

## 3. 모듈 구조

```
backend/src/
├── main.py        # app factory, routers, CORS, 예외 핸들러
├── config.py      # pydantic-settings (.env)
├── database.py    # async engine + sessionmaker + get_session
├── models.py      # Base(naming_convention)
├── folders/       {router,schemas,models,service,repository,exceptions}
├── documents/     {router,schemas,models,service,repository,exceptions}
├── search/        {router,service}
├── generations/   {router,schemas,models,service}
├── storage/       {minio_client,service}
├── pipeline/      {worker,tasks}
└── ai/            {provider,llama_client,bedrock_client(추후),schemas}
```

- 런타임/툴체인: uv로 의존성 관리, Python 3.12 고정. 패키지 `src`는 backend/ 기준 실행(워커 `arq src.pipeline.worker.WorkerSettings`).

## 4. 레이어링

- `router → service → repository → model`
- Pydantic 스키마 ↔ ORM 분리.
- service에서 storage(MinIO)·ai(Provider)·queue(arq/Redis) 호출.
- 조인/집계/트리는 SQL 우선, CPU 무거운 작업(추출·임베딩·생성)은 worker로.

## 5. DB 세션 관리

```python
engine = create_async_engine(settings.DATABASE_URL)        # postgresql+psycopg
async_session = async_sessionmaker(engine, expire_on_commit=False)
async def get_session():
    async with async_session() as s:
        yield s
```

- 트랜잭션은 service 단위. `search_path=archive,archive_ext`(infrastructure §3).

## 6. 설정/구성

- pydantic-settings로 `.env` 로드 → 원격 PG/MinIO/Redis/llama URL·Provider 선택 주입.
- 환경별(dev/prod) 분리.

## 7. API 공통 규약

- 라우트: 복수 명사(`/folders`,`/documents`,`/search`,`/generations`).
- 페이지네이션: `limit`/`offset` 또는 cursor. 문서 목록은 keyset cursor(불투명 base64 `(created_at, id)`).
- 에러: 공통 에러 모델 + 도메인 예외 → 예외 핸들러가 HTTP 매핑. 응답 형태는 `{"error": {code, message, details}}`.
- 보안: 모든 조회/변경에 `owner_id` 스코프 강제(`WHERE owner_id=:user`).
- CORS: web 오리진 허용.

## 8. AI Provider 추상화

```python
class LLMClient(Protocol):
    async def generate(self, *, system: str, prompt: str,
                       params: DecodeParams, json_schema: dict | None = None) -> LLMResult: ...
class EmbeddingClient(Protocol):
    async def embed(self, texts: list[str]) -> list[list[float]]: ...

class LlamaCppLLM(LLMClient): ...        # LLAMA_CHAT_URL /v1/chat/completions
class LlamaCppEmbedding(EmbeddingClient): ...  # LLAMA_EMBED_URL /v1/embeddings (KURE-v1, 고정)
class BedrockLLM(LLMClient): ...         # 추후
```

- 선택: `LLM_PROVIDER`/`EMBEDDING_PROVIDER`로 팩토리 분기.
- 생성별 provider/model 기록은 §11.

## 9. 구조화 출력

- llama.cpp `--json-schema`(GBNF) 호출 래퍼를 ai 모듈에 공통화한다.
- 재사용처: 메타 추출(ingestion-backend.md)·쿼리 파싱(search-backend.md)·차트 스펙(ai-outputs-backend.md).
- 구현은 llama-server의 OpenAI 호환 `response_format: {type: "json_schema"}`로 GBNF를 적용한다.

## 10. 비동기 작업 연동

- `enqueue(task, **kwargs)` 인터페이스(arq). 작업 상태는 `documents.status/stage`·`generations.status`로 조회.
- 멱등 키: 인제스트=`(document_id, stage)`, 생성=`generation_id`.

## 11. 공통 횡단

- 로깅·관측: 생성마다 provider/model·디코딩 파라미터·토큰·지연을 계보(ai-outputs-backend.md)에 기록.
- 헬스체크: 원격 PG/MinIO/Redis/llama 연결 점검. 기동 시 PG/MinIO 도달 실패는 fail-fast(핵심 의존). 런타임 점검은 `GET /health`가 의존성별 상태를 JSON으로 반환한다.

## 12. 운영 배포 전 TODO

- Bedrock 실구현
  - 해결: [ ]
  - 비고: MVP는 인터페이스만, 실구현 제외.
