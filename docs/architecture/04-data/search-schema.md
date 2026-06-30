---
created: 2026-06-12
updated: 2026-06-30
status: approved
overview: 검색(키워드·의미)의 실 SQL을 정의한다.
refs: docs/research/01-mvp-research/02
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

## 3. 점수(score) 해석
- §1 `pgroonga_score`는 매칭 강도다. 질의어가 청크에 얼마나 비중 있게 등장하는지를 재는 빈도 기반(BM25 계열) 랭킹 값이며 코사인 유사도가 아니다. 폴백 `ts_rank`도 같은 성격의 빈도 기반 값이다.
- §2가 돌려주는 값은 코사인 거리(`distance`)다. 애플리케이션이 `1 - distance`로 코사인 유사도로 바꿔 응답의 `score`에 담는다.
- 두 score는 계산 방식과 값 범위가 달라 키워드와 의미 사이에서 비교 대상이 아니다. 각 모드 안의 정렬에만 쓴다.
- 의미 score의 도메인 정의는 search-and-rag §9.
