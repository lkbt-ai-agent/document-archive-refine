---
created: 2026-06-12
updated: 2026-06-12
status: draft
overview: 검색(키워드·의미·하이브리드)의 실 SQL을 정의한다. 도메인 동작은 search-and-rag.md, 구현은 search-backend.md.
refs: research/02
---

# 검색 쿼리

- 인덱스 정의는 `documents-schema.md`: PGroonga `documents.content`, HNSW `document_chunks.embedding`.
- 모든 쿼리는 `owner_id` 필터를 강제한다.

## 1. 키워드 검색 (PGroonga)
```sql
SELECT id, pgroonga_score(tableoid, ctid) AS score
FROM archive.documents
WHERE content &@~ :q AND owner_id = :u
ORDER BY score DESC LIMIT 20;
```
- PGroonga 미설치 시 폴백: `to_tsvector('simple', content)` (품질↓).
- 인덱스 대상은 `documents.content` (문서 단위).

## 2. 의미 검색 (pgvector)
- 질문을 임베딩한 벡터 `:q_vec`로 코사인 거리 정렬.
```sql
SELECT document_id, id AS chunk_id, embedding <=> :q_vec AS distance
FROM archive.document_chunks
WHERE document_id IN (SELECT id FROM archive.documents WHERE owner_id = :u)
ORDER BY embedding <=> :q_vec ASC
LIMIT 50;
```
- HNSW 인덱스(`vector_cosine_ops`) 사용.

## 3. 하이브리드 융합 (RRF)
- `hybrid_search(q_text, q_vec, k=50, n=20, 필터)` 단일 SQL.
- 키워드·벡터를 각각 순위화한 뒤 `1/(k+rank)` 합산. 폴더/날짜/`owner_id` 필터 포함.
```sql
SELECT COALESCE(kw.id, vec.id) AS document_id,
       COALESCE(1.0/(50+kw.rnk), 0) + COALESCE(1.0/(50+vec.rnk), 0) AS score
FROM kw FULL OUTER JOIN vec ON kw.id = vec.id
ORDER BY score DESC LIMIT :n;
```
- `kw`/`vec`는 각각 키워드·의미 검색 결과에 `row_number()` 순위를 매긴 CTE.
- `k=50`은 순위 융합 상수(점수 스케일 독립). 구현은 `search-backend.md`.
