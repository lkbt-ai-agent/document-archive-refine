---
type: failure-pattern
area: backend
tags: [rag, search, llama-cpp, context-size, cors, http-500]
severity: high
status: open
---

# Problem

쉽게 말하면, RAG 검색이 어떤 질문에서는 되고 어떤 질문에서는 깨졌는데, 화면에는 엉뚱하게 "CORS 오류"라고 떴다.

- 사용자가 웹(`http://localhost:3000`)에서 RAG 검색(`POST /search/ask`)을 하면 실패했다.
- 브라우저 콘솔에는 이렇게 떴다. "Access to fetch at 'http://localhost:8000/search/ask' from origin 'http://localhost:3000' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource."
- 메시지만 보면 CORS(서버가 다른 출처의 브라우저 요청을 허용하는 설정) 문제 같았다.
- 그러나 같은 요청을 curl로 보내면 CORS가 아니라 진짜 상태코드 500(서버 내부 오류)이 돌아왔다.
- 모든 질문이 실패한 것도 아니다. 짧은 질문은 200으로 정상 답이 왔고, 어떤 질문만 500이 났다(간헐적).

# Cause

원인은 두 겹이다. 진짜 원인은 생성 LLM의 입력이 너무 길어 서버가 거부한 것이고, 화면의 "CORS"는 그 500이 브라우저에 잘못 비친 착시다.

### 먼저 용어

- 토큰: 모델이 글을 처리하는 최소 단위다. 대략 한국어 한두 글자나 한 단어 조각이 토큰 하나다.
- 컨텍스트(n_ctx): 모델이 한 번에 받아들일 수 있는 최대 토큰 수다. 입력 프롬프트와 생성할 출력이 모두 이 한도 안에 들어가야 한다.
- 슬롯(slot): llama 서버가 동시에 여러 요청을 처리하려고 컨텍스트를 쪼갠 칸이다. 칸을 늘리면 칸 하나가 쓸 컨텍스트는 그만큼 줄어든다.
- RAG: 질문과 관련 있는 문서 조각(청크)을 검색해 프롬프트에 같이 넣고, 그걸 근거로 LLM이 답을 짓는 방식이다.

### 진짜 원인: 프롬프트가 생성 서버의 슬롯 컨텍스트를 넘었다

한 줄 요약: 슬롯 하나는 입력과 출력을 합쳐 4096토큰까지만 받으므로 `프롬프트 토큰 + max_tokens(출력) <= 4096`을 만족해야 한다.

- 생성 서버는 `-c 16384 --parallel 4`로 떠 있다(`scripts/llama-chat.sh`). 컨텍스트 16384를 슬롯 4개로 나누므로 슬롯 하나가 쓰는 컨텍스트는 4096토큰이다.
- 실제로 서버에 물어보면 슬롯당 컨텍스트가 4096으로 확인된다(`GET :8080/props`가 `n_ctx: 4096`, `total_slots: 4`).
- RAG 답변 생성은 프롬프트를 "시스템 + 컨텍스트(검색된 청크 k개) + 질문"으로 만들고 출력은 `max_tokens=1024`를 요청한다(`src/search/service.py:130-134`).
- 기본 검색 개수는 `k=8`이다(`src/search/schemas.py` `AskRequest.k=8`). 청크 한 개 목표가 약 512토큰이라 8개면 그것만으로 약 4096토큰이다.
- 표처럼 큰 청크는 행을 쪼개지 않고 통째로 한 청크에 담기 때문에(청킹 정책) 512토큰보다 훨씬 클 수 있다. 이런 큰 청크가 검색되면 프롬프트만으로 4096을 넘는다.
- 한도를 넘으면 llama 생성 서버는 HTTP 400을 돌려준다. 직접 큰 프롬프트로 찔러 본 응답은 다음과 같다.
  ```json
  {"code":400,"message":"request (12006 tokens) exceeds the available context size (4096 tokens), try increasing it","type":"exceed_context_size_error","n_prompt_tokens":12006,"n_ctx":4096}
  ```
- 백엔드의 LLM 호출부는 응답에 `raise_for_status`를 걸어 두어, 이 400이 `httpx.HTTPStatusError` 예외로 터진다. 아무도 잡지 않아 FastAPI가 500으로 끝낸다.
- 워커 API 로그가 이 경로를 그대로 보여준다. `service.py:132 _generate` 안에서 `Client error '400 Bad Request' for url 'http://localhost:8080/v1/chat/completions'`가 나고 곧이어 `POST /search/ask ... 500 Internal Server Error`로 찍힌다.
- 그래서 짧은 질문은 작은 청크만 물어와 4096 안에 들어가 200이고, 큰 청크를 무는 질문은 넘쳐서 500이다. 이것이 간헐적으로 보인 이유다.

### 착시: 500이 브라우저에는 CORS로 보였다

- CORS 미들웨어는 `app.add_middleware(CORSMiddleware, ...)`로 등록돼 있다(`src/main.py:30`). 이 방식은 Starlette가 자동으로 가장 바깥에 두는 `ServerErrorMiddleware`보다 안쪽에 자리한다.
- 처리되지 않은 예외로 500이 날 때 그 500 응답은 가장 바깥의 `ServerErrorMiddleware`가 만든다. 응답이 안쪽 CORS 미들웨어를 거치지 않으므로 `Access-Control-Allow-Origin` 헤더가 붙지 않는다.
- 브라우저는 그 헤더가 없는 응답을 막고 "CORS 정책에 막혔다"라고 보고한다. 즉 진짜 500을 CORS 오류로 잘못 표시한 것이다.
- curl은 CORS를 강제하지 않으므로 헤더 유무와 무관하게 실제 500을 그대로 본다. 그래서 브라우저와 curl의 결과가 달랐다.
- CORS 설정 자체는 멀쩡하다. 정상 200 응답과 사전 점검(OPTIONS preflight)에는 `Access-Control-Allow-Origin: http://localhost:3000`이 정상으로 붙는다(`src/config.py`의 `cors_origins`/`cors_origin_regex`가 localhost 허용).

# Fix

아직 고치지 않았다. 아래는 후보이며 효과가 큰 순서다. 어느 것도 적용하지 않았다.

- (제안, 권장) 프롬프트 토큰 예산을 슬롯 컨텍스트에 맞춘다. `k`를 8에서 4로 낮추거나, `_build_context`에서 청크별 토큰을 잘라 "프롬프트 + max_tokens"가 4096 이하가 되게 한다.
- (제안) 슬롯 컨텍스트를 늘린다. `-c 32768 --parallel 4`로 슬롯당 8192를 주거나 `--parallel`을 줄인다. GPU 메모리를 더 쓴다.
- (제안) 생성 호출을 방어한다. `_generate`에서 llama 400을 잡아 컨텍스트를 줄여 재시도하거나, 실패 시 사용자 친화 메시지를 반환해 500을 막는다.
- (제안) 에러 응답에도 CORS 헤더가 실리게 한다. 그래야 브라우저에서 실제 원인이 CORS로 가려지지 않는다.
- (제안) `max_tokens`(1024)를 줄인다. 출력 여유는 늘지만 입력이 이미 한도를 넘는 경우는 못 막는다.

# Prevention

- RAG나 LLM 호출 전에 입력과 출력의 토큰 합이 슬롯 컨텍스트(유효 컨텍스트 = `-c` 나누기 `--parallel`)를 넘지 않게 미리 잘라서 보낸다.
- `--parallel`은 컨텍스트를 슬롯 수로 쪼갠다는 점을 기억한다. 표기상 컨텍스트가 16384여도 슬롯당 실제 한도는 4096일 수 있다.
- 외부 LLM 호출의 4xx와 5xx를 그대로 500으로 흘리지 않는다. 사용자 친화 오류나 축소 재시도로 변환한다.
- 에러 응답에도 CORS 헤더가 붙도록 보장해, 브라우저에서 진짜 상태코드가 CORS 메시지에 가려지지 않게 한다.
- 브라우저의 "CORS 오류"를 액면 그대로 믿지 않는다. 같은 요청을 curl로 보내 실제 상태코드를 먼저 확인한다.
