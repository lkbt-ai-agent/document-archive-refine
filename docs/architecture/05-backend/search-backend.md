---
created: 2026-06-12
updated: 2026-06-16
status: approved
overview: 검색·RAG 도메인의 백엔드 구현(API·질의 파싱·검색·생성)을 정의한다.
refs: docs/research/01-mvp-research/02
---

# 검색 & RAG 백엔드

## 1. API 계약

| 메서드 | 경로          | 설명                                                                                                              |
| ------ | ------------- | ----------------------------------------------------------------------------------------------------------------- |
| POST   | `/search`     | `{q, mode, filters{folder,date}, limit}` → `{results[], elapsed_ms}`. `mode∈{keyword,semantic}`, 기본 `semantic`. |
| POST   | `/search/ask` | RAG 질의 → `{answer, citations[{n,chunk_id,document_id,content}], elapsed_ms}`. 비스트리밍 폴백.                  |
| POST   | `/search/ask/stream` | RAG 질의 SSE 스트리밍. `delta`(생성 텍스트 조각) 이벤트를 흘리고 `done`(최종 답변·인용·elapsed_ms) 이벤트로 확정. |

- UI는 단일 검색 진입에서 모드(키워드/의미/rag)를 고르고, 진입은 같되 출력만 갈린다. 키워드/의미는 `/search`(결과 리스트), rag는 `/search/ask`(답변)로 라우팅된다.
- 두 응답 모두 `elapsed_ms`(서버 처리 시간) 포함.
- `/search` 결과 항목은 `{document_id, chunk_id, score, content, display_filename, llm_title, keywords, folder_id, created_at}`이다. 파일명은 현재 파일명(`display_filename`)을 노출하고, `keywords`는 문서 keywords로 프론트가 추가 단건 조회 없이 카드 해시태그를 그리게 응답에 포함한다.

## 2. 모듈 흐름

- `search/router → service`.
- 질의 파싱 단계에서는 구조화 출력(GBNF, backend.md §9)을 사용해 사용자의 한국어 질문에서 의도(`intent`), 재작성 질의(`rewritten_query`), 키워드(`keywords`), 기간 표현(`time_ref`), 폴더(`folder`)를 하나의 구조로 추출한다. 이때 기간 표현은 Python에서 요청 시각을 기준으로 절대 날짜 범위로 환산하고, 모든 질의에는 `owner_id` 스코프를 강제로 적용한다.
- 라우팅
  - keyword: 키워드 SQL → 결과 리스트.
  - semantic: 임베딩(EmbeddingClient) → 의미(벡터) 검색 → 결과 리스트.
  - rag: 임베딩 → 의미 검색 → (MVP 제외) 리랭크 → 컨텍스트 조립 → 인용 강제 생성 → 답변.

## 3. 검색 구현

- 키워드(희소): 청크 단위 PGroonga TokenBigram(한국어), 미설치 시 `to_tsvector('simple')` 폴백. 쿼리는 search-schema §1.
- 의미(밀집): 질문 임베딩 → HNSW cosine. 쿼리는 search-schema §2.

## 4. 리랭킹 (MVP 제외)

- bge-reranker-v2-m3(`llama-server --reranking`, `/v1/rerank`), top-50 → top-5.
- day-1 비활성, Recall 평가 후 투입.

## 5. RAG 생성

- 컨텍스트: 청크 본문 + `{제목,날짜,폴더,chunk_id}`, `[n]↔chunk_id` 매핑 저장.
- 인용·환각 억제 규칙은 search-and-rag.md §6. 그 규칙대로 한국어 시스템 프롬프트를 구성한다.
- 인용 번호 재정렬: 컨텍스트 번호 `n`은 검색 순위 위치라 모델이 일부만 인용하면 3, 5처럼 보인다. 생성 후 실제 인용된 번호를 첫 등장 순서로 모아 1부터 다시 매기고, 답변 텍스트의 `[n]`과 `citations`의 `n`을 같은 매핑으로 함께 바꾸며 인용되지 않은 청크는 제외한다.
- 인용 근거 본문: 각 인용은 근거가 된 청크 본문(`content`)을 함께 돌려준다. 잘라 담은 청크도 근거는 원본 전체 본문을 보여준다. 프론트는 이 본문을 인용 카드에서 펼쳐 왜 그 문서를 인용했는지 보인다.
- 델타(delta): 스트리밍 중 한 번에 도착하는 답변 텍스트 조각으로, 직전까지와 비교해 새로 늘어난 증분이다.
- 스트리밍: `/search/ask/stream`은 파싱·임베딩·검색을 먼저 끝낸 뒤 생성 토큰을 `delta` 이벤트로 흘려보내 첫 토큰까지 시간을 줄인다. 근거 본문은 전체 답변이 필요하므로 생성 완료 후 `done` 이벤트로 확정한다. 토큰 수 측정·예산은 비스트리밍과 동일하다.
- 스트리밍 인용 번호: `delta`의 `[n]`을 도착 순서대로 1부터 증분 재번호해 흘려보낸다. 재번호 규칙이 비스트리밍과 같은 첫 등장 순서라 스트리밍 번호가 `done`의 최종 번호와 일치해 완료 시 번호가 튀지 않는다. `[n]`이 델타 경계로 쪼개질 수 있어 끝의 미완성 `[...` 조각은 보류했다가 다음 델타와 합쳐 처리하고, 매핑에 없는 번호(환각)는 그대로 둔다.
- 컨텍스트 토큰 예산: 생성 서버 슬롯은 입력과 출력을 합쳐 `llama_chat_ctx_per_slot`(기본 4096) 토큰까지 받는다(슬롯당 컨텍스트 = `-c` 나누기 `--parallel`). 컨텍스트를 `예산 = ctx_per_slot - rag_max_tokens - 시스템 - 질문 - rag_ctx_margin`만큼만 담는다. 청크를 순서대로 채우다 예산을 넘으면 멈추고, 단독으로 넘는 청크는 잘라 담아 최소 한 청크를 보장하며, 매핑에는 실제로 담은 청크만 남긴다(인용 번호 정합). 생성 모델 토큰 수는 `:8080/tokenize`로 센다(요청당 소수 호출, lesson 05). 이 예산이 없으면 큰 청크에서 프롬프트가 슬롯 컨텍스트를 넘어 생성 서버가 400을 내고 API가 500으로 샌다.

## 6. 평가 게이트

- ~50개 한국어 골든셋(쿼리→정답 doc_id). Recall@5/@20을 키워드·의미별 측정.
- 인용 존재 이진 체크. CI에서 결정적.

## 7. 운영 배포 전 TODO

- 확장 의존(data-overview §5 선행)
  - 해결: [ ]
  - 비고: `vector`·`pgroonga` 가용성 확인.
- 리랭커 추가 런타임
  - 해결: [ ]
  - 비고: 투입 시 포트/메모리 확보, Recall 평가(§6) 후 결정.
