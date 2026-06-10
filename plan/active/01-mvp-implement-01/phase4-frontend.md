---
status: active
scope: mvp
phase: 4
arch_ref: architecture/10-frontend-drive-ui.md
index: plan.md
---

# Phase 4 — 프론트엔드 구현 (arch 10)

> 공통 규약(전역 제약·구현 규약·코드 스타일)은 [plan.md](./plan.md) 참조.

> [Phase 1](./phase1-frontend-prototype.md) 프로토타입(1.9 + **1.10·1.11·1.12·1.13 개정 반영본**)을 승계한다. 레이아웃은 **Left 트리 / Center 목록 / Right 토글 인스펙터**(하단 상세 패널 없음, arch 10 §4·§8).

- [ ] 4.1 Phase 1 프로토타입(`web`) 승계 — 목업 제거·실 API 배선 전환, `NEXT_PUBLIC_API_URL` 주입 (1.7·1.8·1.10~1.13 재사용)
- [ ] 4.2 AppShell(RSC, 브랜드명 **Mechive**) + ResizablePanels + `HydrationBoundary` 초기 시드
- [ ] 4.3 react-query 클라이언트 + Zustand 스토어 배선
- [ ] 4.4 Left — FolderTree(트리/선택/확장, CRUD/MOVE 드래그, 낙관 업데이트) + 폴더 **"⋯" 드롭다운(이동/이름변경/삭제)** + New/Rename/MoveFolder 다이얼로그 + **AppHeader 토글로 개폐(§8b, 패널 헤더 닫기버튼 없음)** + **우클릭 컨텍스트 메뉴(§8a)** (arch 10 §8a)
- [ ] 4.5 Center — **DocumentList(shadcn `Table` + TanStack Table 헤드리스, 서버 페이지네이션 `manualPagination` → `GET /documents?folder_id=&limit=&cursor=`; 하위 폴더 row 포함 — Google Drive식 §10·§9)** + 폴더 row **"⋯" 액션(이동/이름변경/삭제, 공용 `FolderActions`)** + 폴더 row **단일클릭=인스펙터 토글·더블클릭=진입(§8b)** + **우클릭 컨텍스트 메뉴(폴더/파일, §8a)** + UploadDropzone(presigned 3단계, 진행률 — **MVP UI에서는 미노출, 컴포넌트 보존**). **등록일만 표시**(수정일 비노출, arch 10 §10)
- [ ] 4.6 인제스트 status/stage 폴링 표시(ready/failed 정지)
- [ ] 4.7 Right — **DetailInspector(토글형, 문서/폴더 양쪽 §8b)**: 문서=DocumentDetail(status/stage + **"원본 보기"**: 텍스트=MD 뷰어/기타=다운로드, §10) + **MetadataView(읽기 전용 §7a, 업로드·인제스트 소요 시간 표시)** + GenerationTrigger + **"산출물 내역"(생성 이력 개명; row 클릭→Center가 산출물 문서 폴더로 이동·선택; 출력 문서 삭제 시 비노출; 생성 소요 시간)**; 폴더=FolderDetail(이름/등록일/하위 항목 수)
- [ ] 4.8 검색·**RAG 질문**(AskDialog) — 결과/인용 클릭 → 원문 딥링크, 요약/초안/보고서 생성 UI. **검색·RAG 소요 시간(`elapsed_ms`) 표시**(arch 08 §12)
- [ ] 4.9 반응형 — PC·태블릿(Left 트리+Center 목록 + **Left=AppHeader 토글, Right=row 클릭 토글 §8b**) / 모바일 단일 + Left=`Sheet`(side=left)·**Right=전체 화면 `Sheet`(side=right, 바텀시트 아님)** + **모든 다이얼로그 모바일 풀스크린(상단 정렬)** (arch 10 §12)
- [ ] 4.10 라이트/다크 테마 — `next-themes` 토글 + 듀얼 토큰 적용, 시스템 추종·FOUC 방지 (arch 10 §3)
- [ ] 4.11 **MinIO 버킷 CORS 설정**(브라우저 presigned 호출용)
