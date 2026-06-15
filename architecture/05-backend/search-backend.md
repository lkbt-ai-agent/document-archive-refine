---
created: 2026-06-12
updated: 2026-06-12
status: draft
overview: 검색·RAG 도메인의 백엔드 구현(API·질의 파싱·검색·생성)을 정의한다.
refs: research/02
---

# 검색 & RAG 백엔드

- 공통 구조·구조화 출력은 `backend.md`. 도메인 정의는 `search-and-rag.md`, 실 쿼리는 `search-schema.md`.

## 1. API 계약
| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/search` | `{q, mode, filters{folder,date}, limit}` → `{results[], elapsed_ms}`. `mode∈{keyword,semantic}`, 기본 `semantic`. |
| POST | `/search/ask` | RAG 질의 → `{answer, citations[{n,chunk_id,document_id}], elapsed_ms}`. |
- 두 응답 모두 `elapsed_ms`(서버 처리 시간) 포함. `mode`는 검색 UI에서 사용자가 선택한다.

## 2. 모듈 흐름
- `search/router → service`.
- 질의 파싱: 구조화 출력(GBNF, backend.md §9)으로 `{intent, rewritten_query, keywords, time_ref, folder}` 추출. 날짜는 Python으로 절대 범위 환산, `owner_id` 강제.
- 라우팅
  - keyword: 키워드 SQL → 결과 리스트.
  - semantic: 임베딩(EmbeddingClient) → 의미(벡터) 검색 → 결과 리스트.
  - rag: 임베딩 → 의미 검색 → (선택) 리랭크 → 컨텍스트 조립 → 인용 강제 생성 → 답변.

## 3. 검색 구현
- 키워드(희소): 청크 단위 PGroonga TokenBigram(한국어), 미설치 시 `to_tsvector('simple')` 폴백. 쿼리는 search-schema §1.
- 의미(밀집): 질문 임베딩 → HNSW cosine. 쿼리는 search-schema §2.

## 4. 리랭킹 (선택)
- bge-reranker-v2-m3(`llama-server --reranking`, `/v1/rerank`), top-50 → top-5.
- day-1 비활성, Recall 평가 후 투입.

## 5. RAG 생성
- 컨텍스트: 청크 본문 + `{제목,날짜,폴더,chunk_id}`, `[n]↔chunk_id` 매핑 저장.
- 인용·환각 억제 규칙은 search-and-rag.md §6. 그 규칙대로 한국어 시스템 프롬프트를 구성한다.

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
