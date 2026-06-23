---
created: 2026-06-23
completed: —
overview: 청킹의 줄 단위 토큰 세기를 임베딩 서버 HTTP 호출에서 워커 인프로세스 토크나이저로 바꿔 인제스트 타임아웃과 연결 실패를 없앤다 (lesson 03 권장안 1).
---

> 사고 진단과 권장안 근거는 `docs/lessons/open/03-chunking-tokenize-http-timeout.md`(Cause와 Fix 1번 권장안)다.
> 핵심: 토큰 세기는 가벼운 작업이니 워커 안에서 직접 처리해 `:8081/tokenize` 왕복을 없앤다. 청크 목표 512토큰 대 임베딩 컨텍스트 8192토큰(16배 여유)이라 서버와 토큰 수가 조금 달라도 안전하다.

## 준비 (의존성과 사전 파일)
- [x] A1 `backend/pyproject.toml`에 가벼운 `tokenizers` 의존성을 추가한다 (무거운 `transformers`는 쓰지 않는다).
- [x] A2 KURE-v1 토크나이저 파일을 `~/Desktop/models/kure-v1-tokenizer.json`(gguf와 같은 외부 디렉토리)에 두고 `KURE_TOKENIZER_PATH` 설정으로 로드하며, dev-stack 사전 조건에 1회 다운로드를 적는다.

## 구현 (토크나이저 인프로세스화)
- [x] B1 `backend/src/ingestion/tokenizer.py`의 `count_tokens`를 동봉 토크나이저로 토큰 수를 세도록 바꾼다 (httpx 호출 제거).
- [x] B2 토크나이저는 모듈에서 한 번만 로드해 재사용하고, 토큰 수를 셀 때 자동 특수 토큰과 패딩, 트렁케이션을 끈다 (배치 토큰 수 부풀림 방지).
- [x] B3 `backend/src/ingestion/chunking.py`가 라인을 한 번에 토큰화하도록 `count_tokens_batch`로 바꾸고 CPU 작업을 `asyncio.to_thread`로 오프로드한다 (summary 워크플로우 호출부도 동기화에 맞춰 수정).
- [x] B4 토크나이저 로드 실패 시 인제스트가 명확한 오류로 실패하고 원인이 `error`에 남게 한다 (`Tokenizer.from_file` 예외가 그대로 전파, C1과 함께).

## 부수 개선 (관측성)
- [x] C1 `backend/src/ingestion/pipeline.py`에서 예외 메시지가 비면 예외 타입 이름을 `error`에 기록해, 화면 카드에 원인이 사라지지 않게 한다 (lesson 03 Fix 5번).

## 검증
- [ ] D1 표본 한국어 문장으로 인프로세스 토큰 수가 서버 `/tokenize` 결과와 근접함을 확인한다 (정확 일치는 불필요, 16배 여유).
- [ ] D2 수십 페이지 공고 PDF 한 건이 타임아웃과 ConnectTimeout 없이 인제스트 완료됨을 확인하고 `ingest_ms` 개선을 기록한다.
- [ ] D3 큰 문서 여러 개를 동시에 올려 `:8081` 경합으로 인한 실패가 0건임을 확인한다.

## 문서 반영
- [ ] E1 구현 완료 후 lesson 03의 `status`를 resolved로 바꾸고 Fix에 적용 표기를 단다.
- [ ] E2 아키텍처 ingestion 문서의 토크나이저 절을 인프로세스 방식으로 갱신하고 `:8081/tokenize` 의존 제거를 반영한다 (ingestion-backend §2-4).
