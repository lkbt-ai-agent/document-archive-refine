---
created: 2026-06-28
completed: 2026-06-28
overview: 파일/폴더 목록(DocumentList)에 정렬 필터(최신순, 오래된순, 파일명 오름차순, 파일명 내림차순)를 서버 keyset 정렬과 폴더 클라이언트 정렬로 추가한다.
---

> keyset 페이지네이션이란 "마지막으로 본 행의 정렬 키 값"을 커서로 들고 다니며 그보다 뒤(또는 앞) 행만 가져오는 방식이다. `OFFSET N`처럼 건너뛸 행을 매번 세지 않아 깊은 페이지에서도 빠르고, 중간에 행이 추가/삭제돼도 흔들리지 않는다. 대신 커서가 정렬 기준에 묶여 있어 정렬을 바꾸면 커서도 그 기준으로 바뀌어야 한다.
> 배경: 문서 목록은 서버 keyset 페이지네이션이라 정렬을 페이지 전체에 정확히 적용하려면 서버가 정렬해야 한다(document-backend §1, backend §7). 폴더는 `/folders`가 전량 반환이라 클라이언트에서 정렬한다.
> 정렬 4종: `newest`=created_at 내림차순, `oldest`=created_at 오름차순, `name_asc`=파일명 오름차순, `name_desc`=파일명 내림차순.
> 기본값: `name_asc`(파일명 오름차순). 기존 목록은 created_at 내림차순이었으나 이 기능의 기본값은 이름 오름차순으로 바꾼다. 정렬 상태는 클라이언트 메모리에만 두고 새로고침하면 기본값으로 초기화한다(persist 없음).
> 그룹 규칙: "폴더 먼저, 문서 다음"을 유지하고 각 그룹 내부에서만 정렬한다.
> 범위: 이 정렬은 폴더 문서 목록(`GET /documents`)에만 적용한다. 키워드/의미/RAG 검색(search)의 정렬은 건드리지 않는다.

## A. 백엔드 정렬 파라미터
- [x] A1 `GET /documents`에 `sort` 쿼리 파라미터를 추가한다(enum `newest|oldest|name_asc|name_desc`, 기본 `name_asc`).
- [x] A2 `DocumentService.list`가 `sort`를 받아 repository에 전달한다.
- [x] A3 라우터가 `sort`를 `DocumentSort` enum으로 검증하고 잘못된 값은 422로 거부한다.
- [x] A4 키워드/의미/RAG 검색(search) 라우터와 정렬은 이 작업에서 수정하지 않는다.

## B. 백엔드 keyset 정렬과 커서
- [x] B1 `repository.list_by_folder`가 `sort`에 따라 `ORDER BY`를 바꾸고 동점 결정을 위해 항상 `id`를 마지막 정렬 키로 둔다.
- [x] B2 정렬 키는 `newest`/`oldest`는 `created_at`, `name_asc`/`name_desc`는 `display_filename`을 쓴다.
- [x] B3 keyset `WHERE` 비교 연산자를 정렬 방향에 맞춰 정한다(오름차순은 `>`, 내림차순은 `<`).
- [x] B4 커서를 일반화한다. `(정렬 키 값, id)`를 인코딩하며 정렬 키 값은 `created_at`(ISO)이거나 `display_filename`(문자열)이다(pagination.py).
- [x] B5 클라이언트가 페이지마다 같은 `sort`를 재전송하므로 비교 방향은 `sort`에서 파생하고, 커서에 `sort`를 함께 실어 페이지 간 정렬 불일치를 막는다.
- [x] B6 한글 파일명 정렬은 PostgreSQL 컬레이션을 따르며 로케일 차이로 순서가 미세하게 다를 수 있음을 비고로 남긴다(기능 영향 없음).

## C. UI 프로토타입 (/design, 로직 없음)
- [x] C1 `app/design/list-sort/page.tsx`를 만들어 정렬 드롭다운과 정렬된 목록 비주얼을 정적 더미 데이터로 시안화한다(API 배선·실제 정렬 로직 없음).
- [x] C2 드롭다운은 최신순, 오래된순, 파일명 오름차순, 파일명 내림차순 4개 항목과 현재 선택 체크 표시를 보여준다.
- [x] C3 시안은 "폴더 먼저, 문서 다음" 그룹과 헤더("N개 문서" 옆) 정렬 컨트롤 위치를 시각적으로 보여준다.
- [x] C4 페이지 헤더 주석에 `[디자인 참고용 페이지]` 규약을 따른다(`design/retry`·`design/search-grouped`와 동일 패턴).
- [x] C5 사용자가 프로토타입을 승인하기 전에는 D, E(프론트엔드 실제 구현)에 착수하지 않는다.

## D. 프론트엔드 상태와 데이터 (C 승인 후)
- [x] D1 drive 스토어에 `listSort` 상태와 setter를 추가한다(기본 `name_asc`). persist를 쓰지 않으므로 새로고침하면 기본값으로 초기화된다.
- [x] D2 `qk.documents`를 `(folderId, sort)`로 바꿔 정렬별 캐시와 커서를 분리한다.
- [x] D3 `fetchDocumentsPage`와 `useDocuments`가 `sort`를 받아 쿼리에 싣는다(`getNextPageParam`은 불투명 커서라 그대로다).
- [x] D4 `qk.documents`를 참조하는 호출부(낙관 갱신, 무효화, SSR 프리패치)를 새 시그니처에 맞춘다.

## E. 프론트엔드 폴더 정렬과 UI (C 승인 후)
- [x] E1 `DocumentList`가 폴더 행을 현재 `sort`에 맞춰 클라이언트 정렬한다(`name_*`는 `folder.name`, `oldest|newest`는 `folder.createdAt`).
- [x] E2 폴더 `createdAt`이 없으면 정렬에서 마지막으로 보낸다(누락 안전 처리).
- [x] E3 "폴더 먼저, 문서 다음" 그룹 순서를 유지하고 각 그룹 내부에서만 정렬을 적용한다.
- [x] E4 승인된 시안대로 목록 헤더에 정렬 드롭다운을 배선한다(기존 `DropdownMenu` 재사용, 현재 선택에 체크 표시).

## F. 검증
- [x] F1 네 정렬 모드가 페이지네이션 "더 보기"를 가로질러 순서를 유지함을 확인한다(keyset 정확성).
- [x] F2 빈 폴더와 문서가 많아 다중 페이지인 폴더 모두에서 정렬이 동작함을 확인한다.
- [x] F3 정렬 변경 시 폴더 그룹이 문서보다 항상 먼저 오고 그룹 내부만 재정렬됨을 확인한다.
- [x] F4 한글과 영문이 섞인 파일명이 파일명 정렬에서 일관되게 정렬됨을 확인한다.
- [x] F5 키워드/의미/RAG 검색 결과의 정렬이 이 작업 전후로 동일함을 확인한다(회귀 없음).

## G. 문서 반영
- [x] G1 document-backend §1 API 표에 `sort` 파라미터와 기본값을 반영한다.
- [x] G2 backend §7(또는 pagination.py 설명)에 커서가 정렬 키 값을 담도록 일반화됐음을 반영한다.
- [x] G3 frontend.md 또는 document-frontend에 목록 정렬 필터(서버 정렬+폴더 클라 정렬, 그룹 규칙, 검색 정렬 불변)를 한 단락으로 반영한다.
