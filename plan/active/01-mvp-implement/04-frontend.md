---
created: 2026-06-11
completed: —
overview: Phase 1 프로토타입 승계 → 목업 제거·실 API 배선(Left 트리 / Center 목록·검색결과 / Right 토글 인스펙터, frontend).
---

> UI 컴포넌트 탐색·추가는 shadcn MCP, 라이브러리·API 버전은 context7 MCP로 확인.

## 배선
- [ ] A1 프로토타입(`web`) 승계 — 목업 제거·실 API 전환, `NEXT_PUBLIC_API_URL` 주입 (§1).
- [ ] A2 AppShell(RSC, `Mechive`) + ResizablePanels + `HydrationBoundary` 시드 + Toaster(sonner) (§2·§3).
- [ ] A3 react-query 클라이언트 + Zustand 스토어 배선 (§3·§4).
- [ ] A4 라우팅 — route group `(archive)` 공유 layout + page별 분리, `/`→`/my-archive`·`/folders/{key}`·`/search?q=&mode=` + 전역 404 + `params`/`searchParams` 직접 읽기 + `lib/routes.ts`(`folderHref`/`searchHref`)·`?doc={id}` 딥링크 (§8).

## 3패널
- [ ] B1 Left — FolderTree(CRUD/MOVE+낙관) + "⋯"/컨텍스트 메뉴 + 다이얼로그 + AppHeader 토글 (§5, folders-frontend).
- [ ] B2 Center — DocumentList(shadcn Table+TanStack, 서버 페이지네이션, 하위 폴더 row) + "⋯"/컨텍스트 + 단일=선택·더블=진입 + UploadDropzone(미노출) + 등록일만 (§6, document-frontend).
- [ ] B3 인제스트 `status`/`stage` 폴링 표시(ready/failed 정지) (document-frontend §3).
- [ ] B4 Right — DetailInspector(문서=상세+원본보기+메타+계보+산출물 내역 / 폴더=FolderDetail) (§4·§5·§6).

## 검색·산출물·반응형·테마
- [ ] C1 통합 검색 — SearchBar + "검색..." 모드 드롭다운(키워드/의미/rag), 결과는 Center(리스트/답변)·제목 옆 뒤로가기·소요/개수 + 청크 subrow(전체 표시) (§6, search-frontend).
- [ ] C2 AI 산출물 — 생성 트리거 + 산출물 내역 + 계보 인스펙터 + Report 차트 react-vega 렌더 (§6, ai-outputs-frontend §1·§2·§3·§4).
- [ ] C3 반응형 — PC 3패널 / 모바일 Sheet(Left=left, Right=전체화면 right) + 다이얼로그 풀스크린 (§7).
- [ ] C4 라이트/다크 — next-themes + 듀얼 토큰, FOUC 방지 (§1).
- [ ] C5 MinIO 버킷 CORS 설정(브라우저 presigned 호출용) (§9, infrastructure §4).
