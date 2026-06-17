---
created: 2026-06-12
updated: 2026-06-17
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
- 메뉴에서 모드를 고르면 현재 입력값으로 그 모드의 검색을 실행한다(`/search?q=&mode=`로 이동, §4).
- 모드별 호출: 키워드/의미는 `POST /search`, rag는 `POST /search/ask`(search-backend.md).
- 제출 질의와 선택 모드는 URL이 보관한다(§5). 검색 타입 정의는 search-and-rag.md §2.

## 2. SearchBar 입력
- textarea 기반 입력. 강제개행(Shift+Enter)마다 일정 단계 높이만큼 늘어나는 stepped auto-grow로 디자인한다.
- Enter는 모드 드롭다운을 띄우는 트리거, Shift+Enter는 줄바꿈으로 분리한다.
- 한글 IME 조합 중 Enter는 무시한다(`isComposing` 가드).
- 최대 높이에 도달하면 그 안에서 스크롤한다.
- `≥md`에서 SearchBar를 헤더 중앙에 정렬한다.
- 모바일은 포커스 시 다른 헤더 요소를 가리고 전체 폭을 차지하며, blur 시 한 줄로 접힌다.

## 3. 결과 렌더 (본문 화면)
- 결과는 다이얼로그가 아니라 Center 본문 화면에 렌더하며, 조회(목록) 화면을 검색 결과 화면으로 전환한다.
- 키워드/의미: 본문 화면에 로딩을 먼저 표시하고 검색 결과 리스트를 반환한다.
- rag: 본문 화면에 로딩을 먼저 표시하고 합성 답변과 인용을 반환한다.

### 3a. 공통 메타 (모든 검색 첨부)
- 총 응답 시간(`elapsed_ms`).
- 총 결과 개수(키워드/의미) 또는 총 인용 개수(rag).
- 키워드/의미 결과는 문서 목록 table 디자인을 따른다. 청크 정보는 각 결과 row 아래 카드형 subrow로 표시한다(여백을 적게, 전체 표시, 과한 색조 금지).

### 3b. 결과 row 액션
- 결과 row: 단일 클릭=선택(인스펙터 토글), 더블 클릭/눈 버튼=인스펙터 열기(frontend.md §6b).
- 행 "⋯" 드롭다운과 우클릭 컨텍스트 메뉴: 다운로드, 해당 폴더로 이동, 삭제.
- "해당 폴더로 이동"은 그 문서의 폴더로 이동한 뒤 해당 문서를 선택한다(`folderHref(folderId, docId)`).
- rag 답변의 인용 `[n]` 클릭은 해당 출처로 이동한다.

## 4. 결과 화면 네비게이션
- 본문 상단 좌측, 화면 제목 옆에 뒤로가기 버튼을 둔다.
- 결과 화면은 URL(`/search?q=&mode=`)로 표현한다. 뒤로가기 버튼은 `router.back()`으로 직전 화면(조회 또는 다른 결과)으로 돌아간다.

## 5. 상태 관리
- SearchBar 입력값은 Zustand, 검색/답변 결과는 react-query로 둔다(경계는 frontend.md §5).
- 제출 질의와 모드, 결과 화면 표시 여부는 URL이 진실 소스다(`/search?q=&mode=`, frontend.md §12). Zustand에 결과 화면 상태를 따로 두지 않는다.
