---
created: 2026-06-11
updated: 2026-06-11
status: draft
overview: 키워드(PGroonga)+의미(pgvector)+하이브리드(RRF)+자연어 질의+RAG 답변. 단일 원격 PG에서 동작.
refs: research/02
---

# 검색 & RAG

## 1. 기능 요구사항
- 키워드 검색 / 자연어 검색 / AI·임베딩 활용. schema-rule §5 확장 검증 전제. 대표 시나리오: "작년 내 연봉이 얼마였지?".

## 2. 설계 결정
- 키워드 **PGroonga TokenBigram**(한국어 형태소 미지원 기본 FTS 대체).
- 융합 **RRF k=50 단일 SQL**(스케일 독립, 점수 아닌 순위 융합).
- 자연어 질의 **GBNF 추출 + Python 날짜해석**, `owner_id` 항상 강제.

## 3. 키워드 검색
```sql
SELECT id, pgroonga_score(tableoid, ctid) AS score
FROM archive.documents WHERE content &@~ :q AND owner_id=:u
ORDER BY score DESC LIMIT 20;
```
PGroonga 미설치 시 폴백 `to_tsvector('simple', content)`(품질↓). 인덱스 대상=`documents.content`(문서 단위).

## 4. 의미 검색
질문을 KURE-v1로 임베딩 → `embedding <=> :q_vec`(cosine 거리) ASC, HNSW 인덱스 사용.

## 5. 하이브리드 융합 (RRF)
단일 SQL `hybrid_search(q_text, q_vec, k=50, n=20, 필터)` — 키워드·벡터를 각각 순위화 후 `1/(k+rank)` 합산. 폴더/날짜/`owner_id` 필터 포함.
```sql
SELECT COALESCE(kw.id, vec.id) AS document_id,
       COALESCE(1.0/(50+kw.rnk),0)+COALESCE(1.0/(50+vec.rnk),0) AS score
FROM kw FULL OUTER JOIN vec ON kw.id=vec.id ORDER BY score DESC LIMIT :n;
```

## 6. 리랭킹 (선택·토글)
bge-reranker-v2-m3(`llama-server --reranking`, `/v1/rerank`), top-50→top-5. day-1 비활성, Recall 평가 후 투입.

## 7. 자연어→구조화 질의
GBNF `--json-schema`로 추출:
```json
{ "intent":"keyword|semantic|rag", "rewritten_query":"...",
  "keywords":["..."], "time_ref":"last_year|...", "folder":null }
```
날짜 계산은 Python(상대어→절대 범위, 기준일=요청 시각). `"내"`=`owner_id` 스코프 강제.

## 8. RAG 파이프라인
1. 한국어 쿼리 → 라우팅+추출(GBNF).
2. keyword → PGroonga+필터 → 결과 리스트.
3. semantic/rag → embed → `hybrid_search` RRF → (선택) 리랭크 → 컨텍스트 조립 → 인용 강제 생성 → 답변+출처.
4. 컨텍스트 조립: 청크 본문 + `{제목,날짜,폴더,chunk_id}`, `[n]↔chunk_id` 매핑 저장.

## 9. 인용·환각 억제
한국어 시스템 프롬프트: "제공된 문서에만 근거, 없으면 '찾을 수 없습니다'". 문장마다 `[n]` 인용 강제. 주입 순서: 시스템 규칙 → 컨텍스트 → 질문(마지막).

## 10. 검색 평가 게이트
~50개 한국어 골든셋(쿼리→정답 doc_id). **Recall@5/@20**을 벡터only/하이브리드/+리랭크별 측정. 인용 존재 이진 체크. CI에서 결정적.

## 11. API 계약
| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/search` | `{q, mode?, filters{folder,date}, limit}` → `{results[], elapsed_ms}`. `mode∈{keyword,semantic,hybrid}`, 기본 `hybrid`. (rag 아님) |
| POST | `/search/ask` | RAG 질의 → `{answer, citations[{n,chunk_id,document_id}], elapsed_ms}`. 프론트 "RAG 질문" 전용. |

- 소요 시간: 두 응답 모두 `elapsed_ms`(서버 처리 시간) 포함 — 검색=retrieval, ask=RAG 전체. 프론트는 초 단위 표기. (생성 소요는 `generations.latency_ms`, 인제스트 소요는 `documents.ingest_ms` — `generations-schema.md`·`documents-schema.md`.)
- 프론트 UI: 검색 다이얼로그=`/search`(리스트), "RAG 질문"=`/search/ask`(생성 답변+인용). 검색 UI는 모드 선택 없이 항상 `hybrid` 호출 — `mode?`는 평가 게이트·향후 override용으로 API에만 유지, UI 미노출. `rag`는 §7 라우터 intent일 뿐 `/search` 모드 아님.

## 12. 운영 배포 전 TODO
- 확장 의존(schema-rule §5 선행)
  - 해결: [ ]
  - 비고: `vector`·`pgroonga` 가용성 확인.
- 리랭커 추가 런타임
  - 해결: [ ]
  - 비고: 투입 시 포트/메모리 확보, Recall 평가(§10) 후 결정.
