---
created: 2026-06-28
completed: 2026-06-28
overview: 폴더 목록(DocumentList)에 파일을 끌어다 놓아 업로드하는 기능을 빈 목록과 채워진 목록 모두에서 지원한다.
---

## A. 공용 드롭 핸들러
- [x] A1 `useArchiveActions`가 `onDragOver`·`onDrop` 핸들러를 반환한다.
- [x] A2 `onDragOver`는 `preventDefault()`로 드롭을 허용한다.
- [x] A3 `onDrop`은 `preventDefault()` 후 `uploadFiles(folderId, e.dataTransfer.files)`를 호출한다.
- [x] A4 핸들러는 `e.dataTransfer.files`가 비어 있으면 아무 동작도 하지 않는다.

## B. 목록에 핸들러 부착
- [x] B1 `DocumentList`가 리스트 컨테이너 div(`ContextMenuTrigger` 자식)에 `onDragOver`·`onDrop`를 단다.
- [x] B2 컨테이너 한 곳이 빈 상태와 채워진 상태를 모두 감싸므로 두 경우 모두 드롭이 작동한다.
- [x] B3 별도 드래그 오버레이·하이라이트·스타일 변경을 렌더하지 않는다.
- [x] B4 핸들러를 컨테이너 한 곳에만 부착해 기존 ContextMenu·행 클릭·컬럼 리사이즈와 충돌하지 않는다.

## C. 동작 범위
- [x] C1 업로드 대상 폴더는 `DocumentList`가 받은 현재 `folderId`다(루트 포함).
- [x] C2 디렉터리 드롭과 재귀 업로드는 범위 밖이며 최상위 파일만 받는다(파일 선택창과 동일).
- [x] C3 기존 업로드 흐름(presigned 3단계·진행률·토스트, frontend §10·§11)을 그대로 재사용한다.

## D. 검증
- [x] D1 빈 폴더에 파일을 끌어다 놓으면 업로드가 시작된다.
- [x] D2 폴더와 문서가 있는 폴더에 파일을 끌어다 놓아도 업로드가 시작된다.
- [x] D3 드롭 시 브라우저가 파일을 새 탭으로 여는 기본 동작이 일어나지 않는다.
- [x] D4 단일 파일과 다중 파일이 모두 업로드된다.

## E. 문서 반영
- [x] E1 frontend.md §10에 목록 드래그-앤-드랍 업로드가 같은 공용 훅을 공유한다는 한 줄을 추가한다.
