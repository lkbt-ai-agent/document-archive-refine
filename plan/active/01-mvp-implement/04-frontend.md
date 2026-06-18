---
created: 2026-06-11
completed: 2026-06-18
overview: Phase 1 프로토타입 승계 → 목업 제거·실 API 배선(Left 트리 / Center 목록·검색결과 / Right 토글 인스펙터, frontend).
---

> UI 컴포넌트 탐색·추가는 shadcn MCP, 라이브러리·API 버전은 context7 MCP로 확인.

## 배선
- [x] A1 목업 제거(`lib/mock-data.ts` 삭제) + `lib/api`(client/dto/map/keys/hooks)로 실 API 전환, `NEXT_PUBLIC_API_URL`(`lib/config.ts`·`.env.local`) 주입 (§1).
- [x] A2 AppShell + 서버 프리패치(폴더/문서 첫 페이지) `HydrationBoundary` 시드(`(archive)/layout`·page) + Toaster(sonner) (§2·§3).
- [x] A3 `QueryProvider`(react-query) + Zustand 스토어를 UI 상태 전용으로 축소(서버 데이터·목업 mutation 제거) (§3·§4).
- [x] A4 라우팅 — route group `(archive)` 공유 layout 유지·page별 분리, 가상 루트(`folder_id`/`parent_id` NULL=내 아카이브) + `?doc={id}` 딥링크 + `lib/routes.ts` 헬퍼 (§8).

## 3패널
- [x] B1 Left — FolderTree(`useFolders` + create/rename/move/delete 낙관·롤백) + "⋯"/컨텍스트 + 다이얼로그 + AppHeader 토글 (§5, folders-frontend).
- [x] B2 Center — DocumentList(TanStack Table + `useInfiniteQuery` keyset cursor·더 보기) + 하위 폴더 row + "⋯"/컨텍스트 + 단일=선택·더블=진입 + presigned 다운로드 + UploadDropzone(3단계, 미노출) (§6, document-frontend).
- [x] B3 인제스트 `status`/`stage` react-query 폴링(목록·상세, ready/failed 정지) (document-frontend §3).
- [x] B4 Right — DetailInspector(문서=상세+원본보기(presigned GET 텍스트)+메타+계보+산출물 내역 / 폴더=FolderDetail) (§4·§5·§6).

## 검색·산출물·반응형·테마
- [x] C1 통합 검색 — SearchBar + 모드 드롭다운(키워드/의미=`POST /search`, rag=`POST /search/ask`), 결과는 Center(리스트/답변)·뒤로가기·`elapsed_ms`/개수 + 청크 subrow + 인용 문서명 단건 조회 보강 (§6, search-frontend).
- [x] C2 AI 산출물 — 생성 트리거(`POST /generations` + 진행 폴링) + 산출물 내역 + 계보(`output_document_id` 역조회 → `/lineage`) + Report 차트 react-vega(dynamic ssr:false) 렌더 (§6, ai-outputs-frontend §1·§2·§3·§4).
- [x] C3 반응형 — PC 3패널 / 모바일 Sheet(Left=left, Right=전체화면 right) + 다이얼로그 풀스크린 (프로토타입 승계, §7).
- [x] C4 라이트/다크 — next-themes + 듀얼 토큰, FOUC 방지 (프로토타입 승계, §1).
- [x] C5 MinIO 버킷 CORS — `scripts/minio-cors.sh`(mc `cors set`, web 오리진 GET/PUT/HEAD), 라이브 MinIO에 1회 적용 필요 (§9, infrastructure §4).
