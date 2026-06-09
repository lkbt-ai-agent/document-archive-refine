# 08. 검색 & RAG

## 1. 개요 / 범위
키워드(PGroonga) + 의미(pgvector) + 하이브리드(RRF) + (선택)리랭킹 + 자연어→구조화 질의 + RAG 답변.
모두 **원격 단일 PostgreSQL**에서 동작(02 §6 확장 검증 전제). 대표 시나리오: "작년 내 연봉이 얼마였지?".

## 2. 요구사항 매핑
키워드 검색 / 자연어 검색 / AI·임베딩 활용.

## 3. 설계 결정
- 키워드 **PGroonga TokenBigram**(한국어 형태소 미지원 기본 FTS 대체).
- 융합 **RRF k=50 단일 SQL**(스케일 독립, 점수 아닌 순위 융합).
- 자연어 질의 **GBNF 추출 + Python 날짜해석**, `owner_id` 항상 강제.

## 4. 키워드 검색
```sql
SELECT id, pgroonga_score(tableoid, ctid) AS score
FROM archive.documents WHERE content &@~ :q AND owner_id=:u
ORDER BY score DESC LIMIT 20;
```
PGroonga 미설치 시 폴백 `to_tsvector('simple', content)`(품질↓). 인덱스 대상=`documents.content`(문서 단위).

## 5. 의미 검색
질문을 KURE-v1로 임베딩 → `embedding <=> :q_vec`(cosine 거리) ASC, HNSW 인덱스 사용.

## 6. 하이브리드 융합 (RRF)
단일 SQL `hybrid_search(q_text, q_vec, k=50, n=20, 필터)` — 키워드·벡터를 각각 순위화 후 `1/(k+rank)` 합산. 폴더/날짜/`owner_id` 필터 포함.
```sql
SELECT COALESCE(kw.id, vec.id) AS document_id,
       COALESCE(1.0/(50+kw.rnk),0)+COALESCE(1.0/(50+vec.rnk),0) AS score
FROM kw FULL OUTER JOIN vec ON kw.id=vec.id ORDER BY score DESC LIMIT :n;
```

## 7. 리랭킹 (선택·토글)
bge-reranker-v2-m3(`llama-server --reranking`, `/v1/rerank`), top-50→top-5. day-1 비활성, Recall 평가 후 투입.

## 8. 자연어→구조화 질의
GBNF `--json-schema`로 추출:
```json
{ "intent":"keyword|semantic|rag", "rewritten_query":"...",
  "keywords":["..."], "time_ref":"last_year|...", "folder":null }
```
**날짜 계산은 Python**(상대어→절대 범위, 기준일 = 요청 시각). `"내"`=`owner_id` 스코프 강제.

## 9. RAG 파이프라인
```mermaid
flowchart TD
  Q[한국어 쿼리] --> R[라우팅+추출 GBNF]
  R -->|keyword| K[PGroonga + 필터] --> O1[결과]
  R -->|semantic/rag| E[embed] --> H[hybrid_search RRF]
  H --> RR[(선택)리랭크] --> CX[컨텍스트 조립]
  CX --> G[인용 강제 생성] --> O2[답변+출처]
```
컨텍스트 조립: 청크 본문 + `{제목,날짜,폴더,chunk_id}`, `[n]↔chunk_id` 매핑 저장.

## 10. 인용·환각 억제
한국어 시스템 프롬프트: "제공된 문서에만 근거, 없으면 '찾을 수 없습니다'". 문장마다 `[n]` 인용 강제. 주입 순서: 시스템 규칙 → 컨텍스트 → 질문(마지막).

## 11. 검색 평가 게이트
~50개 한국어 골든셋(쿼리→정답 doc_id). **Recall@5/@20**을 벡터only/하이브리드/+리랭크별 측정. 인용 존재 이진 체크. CI에서 결정적.

## 12. API 계약
| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/search` | `{q, mode?, filters{folder,date}, limit}` → 결과 리스트 |
| POST | `/search/ask` | RAG 질의 → `{answer, citations[{n,chunk_id,document_id}]}` |

## 13. 제약·리스크
확장 의존(02 §6 선행), PGroonga 인덱스=문서 단위, 리랭커 추가 런타임 포트/메모리.

## 참고
`research/02` 전반.
