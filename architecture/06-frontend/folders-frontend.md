---
created: 2026-06-12
updated: 2026-06-17
status: approved
overview: 폴더 도메인의 프론트 구현(트리·액션·다이얼로그·상태)을 정의한다.
refs: research/01-mvp-research/04 §5
---

# 폴더 프론트엔드

- 셸/레이아웃·상태 경계는 `frontend.md`. 도메인 동작은 `folders.md`, API는 `folders-backend.md`.

## 1. 컴포넌트
- FolderTree(Left): 폴더 트리 + CRUD/MOVE. 각 행 "⋯" 드롭다운(§2). 접기/펼치기는 AppHeader 토글. 모바일은 hover가 없어 "⋯"를 항상 노출한다.
- FolderActions: 폴더 "⋯" 공용 드롭다운(Left·Center 양쪽).
- FolderDetail(Right): 폴더 선택 시 이름/등록일/하위 수 읽기 전용.

## 2. 폴더 액션 & 다이얼로그
- 폴더 "⋯" DropdownMenu(공용 `FolderActions`): 이동/이름변경/삭제. 트리 상단엔 "새 폴더".
- 루트 폴더("내 아카이브")는 "⋯"와 우클릭 컨텍스트 메뉴를 노출하지 않는다.
- 우클릭 컨텍스트 메뉴(shadcn `context-menu`): 동일 액션, "⋯"와 핸들러 공유.
- NewFolderDialog: `POST /folders {parent_id?, name}`(folders-backend.md), 형제 중복명 409 인라인.
- RenameFolderDialog: 현재명 pre-fill → `PATCH /folders/{id} {name}`.
- MoveFolderDialog: 폴더 트리 표현 + 대상 상위 선택 → `PATCH /folders/{id} {parent_id}`. 자기 자신·후손 선택 비활성(사이클 422 사전 차단).

## 3. 상태 관리
- 트리는 평면 리스트(folders.md §4)를 `useMemo`로 구성.
- 확장은 Zustand(`expandedFolderIds`), 낙관 업데이트 후 실패 시 롤백. 현재 폴더는 URL에서 파생한다(frontend.md §12).
- 폴더 row: 단일 클릭=선택(하이라이트), 더블 클릭=진입, "눈" 버튼=폴더 인스펙터 열기(frontend.md §6b).
