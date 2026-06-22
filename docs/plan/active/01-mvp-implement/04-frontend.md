---
created: 2026-06-11
completed: —
overview: Phase 1 프로토타입 승계 → 목업 제거/실 API 배선(Left 트리 / Center 목록/검색결과 / Right 토글 인스펙터, frontend).
---

> UI 컴포넌트 탐색/추가는 shadcn MCP, 라이브러리/API 버전은 context7 MCP로 확인.

## 배선

- [x] A1 목업(`lib/mock-data.ts`)을 제거하고 `lib/api`(client/dto/map/keys/hooks)로 실 API에 전환하며 `NEXT_PUBLIC_API_URL`을 주입한다 (§1).
- [x] A2 AppShell에 서버 프리패치(폴더/문서 첫 페이지)를 `HydrationBoundary`로 시드하고 Toaster를 단다 (§2, §3).
- [x] A3 `QueryProvider`를 도입하고 Zustand 스토어를 UI 상태 전용으로 축소한다 (§3, §4).
- [x] A4 route group `(archive)` 공유 layout과 가상 루트, `?doc` 딥링크, `lib/routes.ts` 헬퍼로 라우팅을 구성한다 (§8).

## 3패널

- [x] B1 Left에 FolderTree(생성/이름변경/이동/삭제 낙관/롤백)와 컨텍스트 메뉴, 다이얼로그를 둔다 (§5, folders-frontend).
- [x] B2 Center에 DocumentList(TanStack Table + keyset 무한스크롤), 하위 폴더 row, 컨텍스트 메뉴, presigned 다운로드를 둔다 (§6, document-frontend).
- [x] B3 인제스트 `status`/`stage`를 react-query로 폴링한다(ready/failed에서 정지) (document-frontend §3).
- [x] B4 Right에 DetailInspector(문서=상세/원본보기/메타/계보/산출물, 폴더=FolderDetail)를 둔다 (§4, §5, §6).

## 검색/산출물/반응형/테마

- [x] C1 통합 검색(SearchBar + 모드 드롭다운)으로 키워드/의미는 `/search`, rag는 `/search/ask`를 호출해 Center에 결과를 렌더한다 (§6, search-frontend).
- [x] C2 AI 산출물 생성/진행 폴링/내역/계보/Report 차트를 구현한다 (§6, ai-outputs-frontend §1~§4).
- [x] C3 반응형을 PC 3패널/모바일 Sheet로 구성하고 다이얼로그를 풀스크린 처리한다 (§7).
- [x] C4 next-themes 듀얼 토큰으로 라이트/다크를 지원하고 FOUC를 방지한다 (§1).
- [x] C5 `scripts/minio-cors.sh`로 MinIO 버킷 CORS를 라이브에 1회 적용한다 (§9, infrastructure §4).

## 헤더 액션 메뉴 (후속)

- [x] D1 헤더 "⋯" 드롭다운에 파일 추가/폴더 추가/테마를 PC/모바일 공통으로 제공한다 (§1, §5).
- [x] D2 파일 추가는 숨은 `<input>`과 공용 업로드 훅으로 현재 폴더에 올린다.
- [x] D3 폴더 추가는 `useCreateFolder`와 `FolderNameDialog`를 재사용해 현재 폴더 하위에 만든다.
- [x] D4 업로드 진행률을 `useUpload` XHR로 추적한다(평문 MinIO는 fetch 진행률 불가).
- [x] D5 아키텍처 `frontend.md` §10에 헤더 액션 메뉴 절을 추가한다.
- [x] D6 빈 목록 우클릭 컨텍스트 메뉴로 폴더/파일 추가를 노출한다.
- [x] D7 업로드 진행률을 토스트 대신 인스펙터에 표시하고 단일 업로드 시 문서를 자동 선택한다.
- [x] D8 인제스트 단계 표기를 진행형으로 정정한다 (`lib/format.ts`).

## 인제스트/업로드 진행 표시 (후속)

- [x] D9 `lib/ingest.ts`의 `ingestProgress`가 status/stage를 단계 순서 %로 환산한다(ready/failed는 바 없음).
- [x] D10 DocumentDetail 상태 태그 아래에 진행 바와 캡션을 표시한다(uploaded/processing만).
- [x] D11 아키텍처 `frontend.md` §11에 진행 표시 절을 추가한다.
- [x] D12 진행 바의 "취소"는 확인 후 `useDeleteDocument`로 문서를 삭제한다.
- [x] D13 백엔드가 삭제 전 `abort_job`으로 진행/대기 인제스트 job을 선제 취소한다.
- [x] D14 취소 시 클라이언트 업로드 XHR을 중단해 고아 오브젝트를 막는다 (`lib/upload-control.ts`).
- [ ] D15 (백엔드 후속) OCR 단계 사이 문서 존재를 확인해 협조적 취소로 조기 반환한다(우선순위 낮음).

## 목록 컨텍스트 메뉴 보강 (후속)

- [x] D16 채워진 목록도 배경 우클릭/롱프레스로 폴더/파일 추가를 노출하도록 ScrollArea 전체를 컨텍스트 메뉴 트리거로 감싼다.

## 원본 미리보기 (후속)

- [x] D17 "원본 보기"를 마크다운=뷰어, PDF/이미지=인앱 미리보기, 그 외=다운로드로 분기한다 (document-frontend §2, document-backend §3).
- [ ] D18 (데스크톱 확인 후 결정) 모바일 PDF `<iframe>` 미렌더는 react-pdf/새 탭/현행 중 택일한다.

## 검색 결과 청크 그룹화 (후속)

- [x] D19a 디자인 프로토타입 라우트 `/design/search-grouped`에 그룹 카드 시안을 구현한다(정적 더미).
- [x] D19b 검색 결과를 `documentId`로 묶는 그룹화/정렬 유틸 `lib/search-group.ts`를 만든다.
- [x] D19c `SearchResults`에 문서당 1 카드를 이식하고 row 액션을 문서 단위로 유지한다(청크 UI 최종형은 D28).
- [x] D19d 아키텍처 search-frontend §3a를 갱신한다.

## 검색 결과 화면 보정 (후속)

- [x] D20 `SearchResults` `ScrollArea`에 `min-h-0`을 더해 결과 세로 스크롤을 복구한다.
- [x] D21 답변/인용 카드에 `min-w-0 break-words`를 적용해 RAG 가로 오버플로우를 막는다.

## 메타데이터 토픽 제거 (후속)

- [x] D22 `lib/types.ts`, `dto.ts`, `map.ts`에서 `topics` 필드/매핑을 제거한다.
- [x] D23 `metadata-view.tsx`에서 토픽 표시와 조건을 제거한다(요약/키워드만).
- [x] D24 아키텍처 document-frontend MetadataView 설명에서 토픽을 뺀다.

## 목록 제목 컬럼 리사이즈 (후속)

- [x] D25 목록 "이름" 컬럼을 사용자 리사이즈로 만들고 모바일에서는 비활성화한다 (document-frontend §1).

## 메타데이터 패널 제목 전체 표시 (후속)

- [x] D26 메타패널 큰 제목의 `truncate`를 제거해 `break-words`로 전체 표시한다.

## 파일명 표기 순서 변경 (후속)

- [x] D27 목록 "이름"과 메타패널 큰 제목에 현재 파일명을, 작은 제목에 AI 논리 제목을 표시한다.

## 검색 결과 청크 토글 행 (후속)

- [x] D28 검색 카드의 청크를 화살표 토글 행으로 렌더해 클릭 시 본문을 펼친다(첫 청크 기본 펼침, search-frontend §3a).

## 키워드 검색 해시태그 표시 (후속)

- [x] D31 검색 응답에 문서 `keywords`를 포함한다(백엔드, search-backend §1).
- [x] D32 검색 카드가 키워드/의미 공통으로 `#키워드` 해시태그를 렌더하도록 프론트를 배선하고 `useDocument` 의존을 제거한다.

## 물리 파일명 변경 + 3중 이름 모델 (후속)

- [x] D29 신규 컬럼 `display_filename`(NOT NULL, 최초값=원본명)을 추가해 원본/현재/AI 세 이름을 분리 저장한다 (documents-schema §4).
- [x] D30 목록 row 메뉴의 "이름 변경"으로 현재 파일명을 낙관/롤백 수정하고 원본명과 AI 제목은 보존한다 (document-frontend §1, document-backend §1).
- [x] D33 검색 결과 카드의 큰 제목을 현재 파일명, 작은 제목을 AI 제목으로 노출하도록 검색 응답을 `display_filename` 기준으로 바꾼다 (search-frontend §3a).
