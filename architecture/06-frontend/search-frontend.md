---
created: 2026-06-12
updated: 2026-06-12
status: draft
overview: 검색·RAG 프론트 — SearchBar/SearchResults·AskDialog, 인용 딥링크·소요 표시. 셸은 frontend.md.
refs: research/04 §5
---

# 검색 & RAG 프론트엔드

- 셸/레이아웃은 `frontend.md`. 도메인 정의는 `search-and-rag.md`, API는 `search-backend.md`.
- 출력물이 다르므로 검색(retrieval)과 RAG 질문(QA)을 분리한다.

## 1. 검색 다이얼로그 (retrieval)
- SearchBar → SearchResults: `POST /search`(search-backend.md) → 문서/청크 결과 리스트.
- 모드 선택 UI 없이 항상 하이브리드 고정, 모드 뱃지 없음.
- 결과·인용 클릭 → 원문 딥링크. 검색 소요(`elapsed_ms`) 표시.

## 2. RAG 질문 (AskDialog)
- AskDialog: `POST /search/ask`(search-backend.md) → 합성 답변 1개 + 인용 `[n]`. 라벨 "RAG 질문".
- 프롬프트 입력은 auto-grow textarea(Enter=전송 / Shift+Enter=줄바꿈).
- RAG 전체 소요(`elapsed_ms`) 표시.

## 3. 상태 관리
- 검색 입력값/결과는 react-query, 다이얼로그 개폐는 Zustand.
- (`rag`는 search-and-rag.md §3 라우터 의도일 뿐, 검색 결과 리스트의 모드가 아님.)
