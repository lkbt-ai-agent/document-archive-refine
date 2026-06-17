---
created: 2026-06-12
updated: 2026-06-17
status: approved
overview: 문서 도메인의 프론트 구현(목록·업/다운로드·원본 보기·상세·폴링)을 정의한다.
refs: research/01-mvp-research/04 §5
---

# 문서 프론트엔드

- 셸/레이아웃·상태 경계는 `frontend.md`. 도메인 동작은 `document.md`, API는 `document-backend.md`.

## 1. 목록 (Google Drive식)
- DocumentList: shadcn `Table` + TanStack Table v8 헤드리스(`useReactTable`/`getCoreRowModel`, `manualPagination: true`) — 서버 페이지네이션.
- 목록 계약 `GET /documents?folder_id=&limit=&cursor=`(document-backend.md) + react-query 바인딩. API·옵션은 context7로 v8 확인 후 작성.
- 컬럼: 이름, 상태, 크기, 등록일. 폴더 행은 상태/크기에 대시 자리표시(`-`)를 둔다.
- 하위 폴더 row + 문서 row(폴더 먼저). 단일 클릭=선택(하이라이트), 더블 클릭/눈 버튼=열기(문서=문서 인스펙터, 폴더 더블=진입/폴더 눈=폴더 인스펙터). 상세 규칙은 frontend.md §6b.
- 행 "⋯" 드롭다운과 우클릭 컨텍스트 메뉴(문서=다운로드/삭제, 폴더=FolderActions, folders-frontend.md).
- AI 산출물도 일반 문서 행으로 표기(ai-outputs-frontend.md).

## 2. 업로드 / 다운로드 / 원본 보기
- 업로드: presigned 3단계(document.md §3) UX 유지하되 MVP UI 미노출(`UploadDropzone` 보존). 진행률 + 인제스트 폴링.
- 원본 미리보기 영역 없음. DocumentDetail에 "원본 보기" 버튼만.
  - 텍스트류(`text/markdown`·`text/plain`): `OriginalViewerDialog` 마크다운 뷰어(인앱 열람).
  - 그 외(PDF·이미지·바이너리): presigned GET 다운로드(인앱 렌더 안 함).
- 표시 날짜는 등록일(`created_at`)만 — 인앱 편집 없어 수정일 무의미(`updated_at`·`doc_modified_at` 미노출).

## 3. DocumentDetail / 인제스트 폴링
- 인스펙터는 "문서 상세" 헤더만 고정하고 그 아래 전체를 단일 스크롤한다.
- 본문은 상세(크기/형식/페이지/작성자/등록일/처리 시간)와 메타데이터/산출물 탭으로 구성한다.
- DocumentDetail(Right): `status`/`stage` react-query 폴링(ready/failed 정지) + "원본 보기".
- MetadataView: AI 메타(제목/요약/토픽/키워드) 읽기 전용 + 인제스트 소요(`documents.ingest_ms`).
- 소요 시간은 초 단위 표기.

## 4. 상태 관리
- react-query: 목록·상세 + `status/stage` 폴링. Zustand: 선택 문서(`selectedDocumentId`).
- 업로드/인제스트 완료·실패는 Toaster 알림.
