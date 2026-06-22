---
created: 2026-06-10
completed: 2026-06-10
overview: docs/architecture/04 작성 플랜 — FastAPI 도메인 구조·레이어링·async DB·Provider 추상화(완료).
---

## 작성 단계
- [x] S1 모듈 구조(도메인 패키지 + 레이어 파일).
- [x] S2 레이어링(router→service→repository→model).
- [x] S3 DB 세션 관리(async, get_session, expire_on_commit=False).
- [x] S4 설정(pydantic-settings, 원격 URL 주입).
- [x] S5 API 공통 규약(페이지네이션·에러·CORS·owner_id 강제).
- [x] S6 Provider 추상화(LLMClient/EmbeddingClient + 팩토리).
- [x] S7 구조화 출력(GBNF `--json-schema` 래퍼).
- [x] S8 비동기 작업 연동(arq enqueue·상태조회·멱등 키).
- [x] S9 횡단(로깅·관측·헬스체크 fail-fast).
