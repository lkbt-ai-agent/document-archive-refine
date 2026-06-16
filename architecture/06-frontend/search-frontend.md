---
created: 2026-06-12
updated: 2026-06-16
status: approved
overview: 검색과 RAG 도메인의 프론트 구현으로 통합 SearchBar 진입, 본문 결과 렌더, 메타 첨부, 화면 네비게이션을 정의한다.
refs: research/01-mvp-research/04 §5
---

# 검색 & RAG 프론트엔드

- 셸/레이아웃은 `frontend.md`. 도메인 정의는 `search-and-rag.md`, API는 `search-backend.md`.
- 검색(retrieval)과 rag(QA)는 SearchBar 진입을 공유하되, 출력물이 달라 본문 렌더가 갈린다.

## 1. 검색 진입과 모드 선택
- AppHeader의 SearchBar 옆에 shadcn DropdownMenu 버튼(라벨 "검색...")을 둔다.
- 버튼 클릭 또는 SearchBar에서 Enter 시 키워드/의미/rag 드롭다운 메뉴를 띄운다.
- 메뉴에서 모드를 고르면 현재 입력값으로 그 모드의 검색을 실행한다.
- 모드별 호출: 키워드/의미는 `POST /search`, rag는 `POST /search/ask`(search-backend.md).
- 선택 모드는 Zustand에 보관한다(§5). 검색 타입 정의는 search-and-rag.md §2.

## 2. SearchBar 입력
- textarea 기반 입력. 강제개행(Shift+Enter)마다 일정 단계 높이만큼 늘어나는 stepped auto-grow로 디자인한다.
- Enter는 모드 드롭다운을 띄우는 트리거, Shift+Enter는 줄바꿈으로 분리한다.
- 최대 높이에 도달하면 그 안에서 스크롤한다.

## 3. 결과 렌더 (본문 화면)
- 결과는 다이얼로그가 아니라 Center 본문 화면에 렌더하며, 조회(목록) 화면을 검색 결과 화면으로 전환한다.
- 키워드/의미: 본문 화면에 로딩을 먼저 표시하고 검색 결과 리스트를 반환한다.
- rag: 본문 화면에 로딩을 먼저 표시하고 합성 답변과 인용을 반환한다.

### 3a. 공통 메타 (모든 검색 첨부)
- 총 응답 시간(`elapsed_ms`).
- 총 결과 개수(키워드/의미) 또는 총 인용 개수(rag).
- 청크 정보는 각 리스트 row 아래에 toggle 메뉴로 펼쳐 표시한다.

## 4. 결과 화면 네비게이션
- 본문 상단 좌측, 화면 제목 옆에 뒤로가기 버튼을 둔다.
- 클릭 시 검색 결과 화면에서 조회(목록) 화면으로 돌아간다.

## 5. 상태 관리
- 검색 입력값과 선택 모드는 Zustand, 검색/답변 결과는 react-query로 둔다(경계는 frontend.md §5).
- 결과 화면 표시 여부(조회 화면 vs 검색 결과 화면)는 Zustand로 관리한다.
