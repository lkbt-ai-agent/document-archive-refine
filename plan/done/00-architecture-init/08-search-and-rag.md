---
created: 2026-06-10
completed: 2026-06-10
overview: architecture/08 작성 플랜 — 키워드+의미+하이브리드(RRF)+NL 질의+RAG 파이프라인(완료).
---

## 작성 단계
- [x] S1 개요/범위(2모드, 대표 시나리오).
- [x] S2 키워드 검색(PGroonga `&@~`, 폴백).
- [x] S3 의미 검색(KURE-v1 임베딩, HNSW cosine).
- [x] S4 하이브리드 융합(RRF k=50 단일 SQL).
- [x] S5 리랭킹(bge-reranker, 토글·day-1 비활성).
- [x] S6 NL→구조화 질의(GBNF + Python 날짜, owner_id 강제).
- [x] S7 RAG 파이프라인(조립 + 인용 강제 생성).
- [x] S8 인용·환각 억제(한국어 프롬프트).
- [x] S9 검색 평가 게이트(Recall@5/@20 골든셋).
- [x] S10 API 계약.
