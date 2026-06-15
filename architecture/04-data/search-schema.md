---
created: 2026-06-12
updated: 2026-06-12
status: approved
overview: 검색(키워드·의미)의 실 SQL을 정의한다.
refs: research/01-mvp-research/02
---

# 검색 쿼리

- 인덱스 정의는 `documents-schema.md`: PGroonga `document_chunks.content`, HNSW `document_chunks.embedding`.
- 키워드·의미 모두 청크 단위로 검색하고, 소유자 필터는 상위 문서를 경유해 건다.

## 1. 키워드 검색 (PGroonga)
- 청크 본문에 키워드 매칭, 매칭 청크·소속 문서 반환.
```sql
SELECT c.document_id, c.id AS chunk_id, pgroonga_score(c.tableoid, c.ctid) AS score
FROM archive.document_chunks c
WHERE c.content &@~ :q
  AND c.document_id IN (SELECT id FROM archive.documents WHERE owner_id = :u)
ORDER BY score DESC LIMIT 20;
```
- PGroonga 미설치 시 폴백: `to_tsvector('simple', c.content)` (품질↓).
- 인덱스 대상은 `document_chunks.content` (청크 단위).

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
