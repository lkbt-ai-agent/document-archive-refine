---
created: 2026-06-11
updated: 2026-06-15
status: draft
overview: 3패널 Drive UI 셸(레이아웃·서버/클라 분리·데이터/상태 경계·테마·반응형)을 정의한다.
refs: research/04 §5
---

# 프론트엔드 셸 (3-Panel Drive UI)

- 도메인별 UI 구현은 `folders-frontend.md`·`document-frontend.md`·`search-frontend.md`·`ai-outputs-frontend.md`.

## 1. 범위
- 3패널 Drive UI: 서버/클라이언트 분리, 데이터·상태 관리, 컴포넌트, 반응형.
- 제품 표기명 `Mechive` — 브라우저 타이틀·헤더 브랜드. (저장소/버킷 식별자 `document-archive-refine`은 불변, 표시명만.)

## 2. 요구사항
- 3-Panel 레이아웃, 폴더/문서 CRUD, 업/다운로드, 검색·AI 산출물 UI, 라이트/다크 테마, PC/태블릿/모바일 3단 반응형.

## 3. 설계 결정
- react-query 1차 데이터 레이어 + Zustand UI 상태, RSC 셸 + Client 패널.
- 파일 업/다운로드는 원격 MinIO presigned 직접 호출(document). API는 `NEXT_PUBLIC_API_URL` 주입.
- 테마: `next-themes` + Tailwind `dark:` / shadcn CSS 변수 듀얼 토큰, 시스템 추종 + 수동 토글, FOUC 방지(`suppressHydrationWarning`).
- 반응형: PC/태블릿/모바일 3단(Tailwind `lg`/`md`). 상세 §12.

## 4. 전체 레이아웃 컴포넌트 맵
```
ThemeProvider (next-themes, attribute="class" defaultTheme="system" enableSystem)   # §3
└─ AppShell (RSC)                                 # 브랜드명 "Mechive"(§1), 초기 트리·목록 패치(Suspense)
   ├─ AppHeader (client)                          # SearchBar + ThemeToggle(light/dark/system)
   │  ├─ SearchBar → SearchResults (client)       # 검색·결과, 인용 클릭 딥링크(§11)
   │  └─ AskDialog (client)                       # RAG 질의(Dialog)
   ├─ ResizablePanels (client, ≥md)               # 모바일(<md)은 단일 패널로 대체(§12)
   │  ├─ LeftPanel: FolderTree (client)           # 선택/확장(Zustand), AppHeader 토글(§8b). 모바일=Sheet
   │  │  └─ FolderActions ("⋯" DropdownMenu)      # 이동/이름변경/삭제(§8a, Left·Center 공용)
   │  ├─ CenterPanel                              # 문서 "목록" 전용
   │  │  ├─ (UploadDropzone)                      # presigned PUT — 컴포넌트 보존, MVP UI 미노출(§10)
   │  │  └─ DocumentList (client)                 # 하위 폴더 row + 문서 row(§10). 폴더 row: 단일=인스펙터/더블=진입 + "⋯"
   │  └─ RightPanel = DetailInspector             # 토글형(§8b), 문서/폴더 양쪽. 모바일=전체화면 Sheet(side=right)
   │     ├─ DocumentDetail (client)               # status/stage 폴링 + "원본 보기"(§10)
   │     ├─ MetadataView (client)                 # AI 메타 읽기 전용(§7a) + 인제스트 소요(§11)
   │     ├─ GenerationTrigger (client)            # 요약/초안/보고서 생성 시작(Dialog)
   │     ├─ ArtifactList "산출물 내역" (client)    # 생성 이력, row 클릭=산출물 문서 폴더로 이동(§11)
   │     └─ FolderDetail (client)                 # 폴더 선택 시 이름/등록일/하위 수(§7a)
   ├─ Dialogs (client, 모바일 풀스크린 §12)        # NewFolder/Rename/MoveFolder/DeleteConfirm/OriginalViewer
   └─ Toaster (sonner, client)                    # 업로드/인제스트/생성 완료·실패 알림
```
- 도메인별 컴포넌트 상세는 각 `<domain>-frontend.md`. 이 맵은 셸 골격만 정의한다.

## 5. 서버/클라이언트 분리
- RSC: 페이지 셸·초기 패치(패널별 Suspense 스트리밍).
- Client(`"use client"`): 트리/드롭존/다이얼로그/인스펙터 토글 등 고상호작용.

## 6. 데이터 레이어
- react-query(목록/상세/트리 + 파이프라인·생성 폴링 + 캐시·낙관 업데이트).
- RSC 초기 렌더는 `HydrationBoundary`로 시드. Server Actions는 선택(FastAPI와 로직 중복 금지).

## 7. UI 상태
- 선택/확장은 Zustand. 트리는 평면 리스트(folders §4)에서 `useMemo` 구성. 낙관 업데이트 후 실패 시 롤백.
- Zustand(클라 UI): `selectedFolderId`/`selectedDocumentId`, `expandedFolderIds`, 모바일 Sheet 개폐, 검색 입력값/모드. 선택 상태가 react-query 쿼리 키를 구동.
- react-query(서버 데이터): 트리·목록·상세·검색 결과·생성 이력 + 폴링. 캐시·낙관·무효화.
- next-themes: 테마 — Zustand에 두지 않음(자체 persistence·SSR).
- 경계 원칙: 서버 출처면 react-query, 클라 전용(선택/토글/입력)이면 Zustand. 서버 데이터 Zustand 복제 금지.

### 7a. 인스펙터 표시 (읽기 전용 — MVP)
- 문서 본문은 편집하지 않는다(읽기 전용 보관함). AI 추출 메타도 읽기 전용 표시.
- 문서/폴더 상세·메타·소요 시간·계보 표시 상세는 `document-frontend.md`·`ai-outputs-frontend.md`.

## 8. 패널 구성 (Left 트리 / Center 목록 / Right 토글 인스펙터)
- Left: 폴더 트리 + CRUD/MOVE. 상세는 `folders-frontend.md`.
- Center: 문서 목록 전용(Google Drive식 — 하위 폴더 row + 문서 row, 폴더 먼저). 상세는 `document-frontend.md`.
- Right = DetailInspector(토글형 §8b): 문서=상세+메타+생성 트리거·"산출물 내역", 폴더=FolderDetail. 개폐는 row 클릭 토글.

### 8a. 폴더 액션 & 다이얼로그
- 폴더 "⋯"/우클릭 컨텍스트 메뉴·다이얼로그 상세는 `folders-frontend.md`.

### 8b. 패널 토글 규칙 (Left / Right)
- Right 인스펙터: 토글 — 문서 row 클릭/폴더 row 단일 클릭으로 열고, 같은 row 재클릭 시 닫힘. 상태는 Zustand 선택 항목(`selected: {kind,id} | null`). 폴더 더블 클릭=진입. 패널에 닫기 버튼 없음.
- Left 트리: AppHeader 토글로 접고/펼침, 접힘 상태 Zustand(`leftCollapsed`).
- 브레이크포인트: `≥md`는 패널 펼침/접힘, `<md`는 Left=`Sheet`(side=left)·Right=전체화면 `Sheet`(side=right)(§12).

## 9. 컴포넌트 선정·커스터마이징 전략
- shadcn/ui MCP로 적합 컴포넌트 탐색·선정, 커스터마이징은 Tailwind. 빌딩블록: Resizable, tree-view, dropzone→presigned PUT, Lucide.
- 도메인별 컴포넌트 매핑·API 바인딩은 각 `<domain>-frontend.md`.

## 10. 목록·업로드·원본 보기
- 상세는 `document-frontend.md`.

## 11. 검색·AI 산출물 UI
- 검색·RAG UI 상세는 `search-frontend.md`, AI 산출물(생성 트리거·산출물 내역·계보)은 `ai-outputs-frontend.md`.

## 12. 반응형 (PC/태블릿/모바일)
- PC·태블릿(`≥md` 768+): Left 트리 + Center 목록 + ResizablePanels. Left는 AppHeader 토글, Right는 row 클릭 토글(§8b).
- 모바일(`<md`): 단일 패널(Center) + Left=`Sheet`(side=left)·Right=전체화면 `Sheet`(side=right).
- 다이얼로그 풀스크린: 모든 Dialog는 모바일에서 전체화면(`w-screen h-dvh`·라운드/마진 제거), 콘텐츠 상단 정렬.
- 패널별 독립 스트리밍. 테마는 모든 브레이크포인트 공통(§3).

## 13. 운영 배포 전 TODO
- 브라우저→원격 MinIO presigned 호출 CORS
  - 해결: [ ]
  - 비고: 버킷 CORS 설정 필요(infrastructure §4 연계).
- 폴링 주기
  - 해결: [ ]
  - 비고: 인제스트·생성 폴링 간격 부하 보고 조정.
