---
created: 2026-06-11
completed: —
overview: Phase 1 프로토타입 승계 → 목업 제거·실 API 배선(Left 트리 / Center 목록 / Right 토글 인스펙터, arch 10).
---

## 배선
- [ ] A1 프로토타입(`web`) 승계 — 목업 제거·실 API 전환, `NEXT_PUBLIC_API_URL` 주입.
- [ ] A2 AppShell(RSC, `Mechive`) + ResizablePanels + `HydrationBoundary` 시드.
- [ ] A3 react-query 클라이언트 + Zustand 스토어 배선.

## 3패널
- [ ] B1 Left — FolderTree(CRUD/MOVE 드래그·낙관) + "⋯"/컨텍스트 메뉴 + 다이얼로그 + AppHeader 토글 (§8a).
- [ ] B2 Center — DocumentList(shadcn Table+TanStack, 서버 페이지네이션, 하위 폴더 row) + "⋯"/컨텍스트 메뉴 + 단일=토글·더블=진입 + UploadDropzone(미노출) + 등록일만 (§9·§10).
- [ ] B3 인제스트 status/stage 폴링 표시(ready/failed 정지).
- [ ] B4 Right — DetailInspector(문서=상세+원본보기+메타+계보+산출물 내역 / 폴더=FolderDetail) (§7a·§8b·§11).

## 검색·반응형·테마
- [ ] C1 검색·RAG 질문(AskDialog) — 인용 딥링크 + 생성 UI + 소요 시간 표시 (arch 08 §12).
- [ ] C2 반응형 — PC 3패널 / 모바일 Sheet(Left=left, Right=전체화면 right) + 다이얼로그 풀스크린 (§12).
- [ ] C3 라이트/다크 — next-themes + 듀얼 토큰, FOUC 방지 (§3).
- [ ] C4 MinIO 버킷 CORS 설정(브라우저 presigned 호출용).
