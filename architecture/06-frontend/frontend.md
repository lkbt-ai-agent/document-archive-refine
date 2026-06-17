---
created: 2026-06-11
updated: 2026-06-17
status: approved
overview: 3패널 Drive UI 셸(레이아웃·서버/클라 분리·데이터/상태 경계·테마·반응형·라우팅)을 정의한다.
refs: research/01-mvp-research/04 §5
---

# 프론트엔드 셸 (3-Panel Drive UI)

## 1. 범위 / 요구사항 / 설계 결정
- 3패널 Drive UI 셸을 정의한다. 제품 표기명은 `Mechive`로 브라우저 타이틀과 헤더 브랜드에 쓴다(저장소/버킷 식별자 `document-archive-refine`은 불변, 표시명만 바꾼다).
- 헤더 브랜드 "Mechive"는 "Me"를 강조 배지로 표시한다. 브랜드 클릭 시 루트 폴더 "내 아카이브"(`/my-archive`)로 이동한다(§12).
- 루트 폴더 표시명은 "내 아카이브"이며 경로는 `/my-archive`이다.
- 헤더는 고정 높이를 유지한다. SearchBar가 늘어나도 헤더와 레이아웃 높이는 변하지 않는다(textarea 내부 스크롤).
- 기능 요구: 폴더/문서 CRUD, 업/다운로드, 검색과 AI 산출물 UI, 라이트/다크 테마, PC/태블릿/모바일 3단 반응형.
- 데이터/상태: react-query 1차 데이터 레이어 + Zustand UI 상태, RSC 셸 + Client 패널.
- 파일 업/다운로드는 원격 MinIO presigned를 브라우저가 직접 호출한다(document). API 주소는 `NEXT_PUBLIC_API_URL`로 주입한다.
- 테마: `next-themes` + Tailwind `dark:` / shadcn CSS 변수 듀얼 토큰, 시스템 추종 + 수동 토글, FOUC 방지(`suppressHydrationWarning`).
- 반응형: PC/태블릿/모바일 3단(Tailwind `lg`/`md`). 상세는 §10.

## 2. 전체 레이아웃 컴포넌트 맵
```
ThemeProvider (next-themes, attribute="class" defaultTheme="system" enableSystem)   # §1
└─ AppShell (RSC)                                 # 브랜드명 "Mechive"(§1), 초기 트리·목록 패치(Suspense)
   ├─ AppHeader (client)                          # SearchBar + ThemeToggle(light/dark/system)
   │  └─ SearchBar (client)                       # "검색..." 모드 드롭다운(키워드/의미/rag), 결과는 Center(§9)
   ├─ ResizablePanels (client, ≥md)               # 모바일(<md)은 단일 패널로 대체(§10)
   │  ├─ LeftPanel: FolderTree (client)           # 선택/확장(Zustand), AppHeader 토글(§6b). 모바일=Sheet
   │  │  └─ FolderActions ("⋯" DropdownMenu)      # 이동/이름변경/삭제(§6a, Left·Center 공용)
   │  ├─ CenterPanel                              # 문서 목록 + 검색 결과 화면(§9)
   │  │  ├─ (UploadDropzone)                      # presigned PUT — 컴포넌트 보존, MVP UI 미노출(§8)
   │  │  ├─ DocumentList (client)                 # 하위 폴더 row + 문서 row(§8). 폴더 row: 단일=선택/더블=진입/눈=인스펙터 + "⋯"
   │  │  └─ SearchResults (client)                # 검색 결과 리스트/답변 + 제목 옆 뒤로가기(§9)
   │  └─ RightPanel = DetailInspector             # 토글형(§6b), 문서/폴더 양쪽. 모바일=전체화면 Sheet(side=right)
   │     ├─ DocumentDetail (client)               # status/stage 폴링 + "원본 보기"(§8)
   │     ├─ MetadataView (client)                 # AI 메타 읽기 전용(§5a) + 인제스트 소요(§9)
   │     ├─ GenerationTrigger (client)            # 요약/초안/보고서 생성 시작(Dialog)
   │     ├─ ArtifactList "산출물 내역" (client)    # 생성 이력, row 클릭=산출물 문서 폴더로 이동(§9)
   │     └─ FolderDetail (client)                 # 폴더 선택 시 이름/등록일/하위 수(§5a)
   ├─ Dialogs (client, 모바일 풀스크린 §10)        # NewFolder/Rename/MoveFolder/DeleteConfirm/OriginalViewer
   └─ Toaster (sonner, client)                    # 업로드/인제스트/생성 알림. position top-center, 배경색 없이 타입 아이콘으로 성공/실패 구분
```
- 도메인별 컴포넌트 상세는 각 `<domain>-frontend.md`. 이 맵은 셸 골격만 정의한다.

## 3. 서버/클라이언트 분리
- RSC: 페이지 셸·초기 패치(패널별 Suspense 스트리밍).
- Client(`"use client"`): 트리/드롭존/다이얼로그/인스펙터 토글 등 고상호작용.

## 4. 데이터 레이어
- react-query(목록/상세/트리 + 파이프라인·생성 폴링 + 캐시·낙관 업데이트).
- RSC 초기 렌더는 `HydrationBoundary`로 시드. Server Actions는 선택(FastAPI와 로직 중복 금지).

## 5. UI 상태
- 선택/확장은 Zustand. 트리는 평면 리스트(folders §4)에서 `useMemo` 구성. 낙관 업데이트 후 실패 시 롤백.
- Zustand(클라 UI): 인스펙터 선택/하이라이트(`selectedDocumentId`/`inspectedFolderId`), `expandedFolderIds`, 좌우 패널 토글, 모바일 Sheet 개폐, SearchBar 입력값. 선택 상태가 react-query 쿼리 키를 구동.
- 현재 폴더와 검색(제출 질의/모드)은 Zustand가 아니라 URL이 진실 소스다(§12). 현재 폴더는 `useCurrentFolderId`(`useParams`/`usePathname`)로 파생한다.
- react-query(서버 데이터): 트리·목록·상세·검색 결과·생성 이력 + 폴링. 캐시·낙관·무효화.
- next-themes: 테마 — Zustand에 두지 않음(자체 persistence·SSR).
- 경계 원칙: 서버 출처면 react-query, 클라 전용(선택/토글/입력)이면 Zustand. 서버 데이터 Zustand 복제 금지.

### 5a. 인스펙터 표시 (읽기 전용 — MVP)
- 문서 본문은 편집하지 않는다(읽기 전용 보관함). AI 추출 메타도 읽기 전용 표시.
- 문서/폴더 상세·메타·소요 시간·계보 표시 상세는 `document-frontend.md`·`ai-outputs-frontend.md`.

## 6. 패널 구성 (Left 트리 / Center 목록 / Right 토글 인스펙터)
- Left: 폴더 트리 + CRUD/MOVE. 상세는 `folders-frontend.md`.
- Center: 문서 목록(Google Drive식 — 하위 폴더 row + 문서 row, 폴더 먼저) + 검색 결과 화면(§9). 상세는 `document-frontend.md`.
- Right = DetailInspector(§6b): 문서=상세+메타+생성 트리거+"산출물 내역", 폴더=FolderDetail. 단일 클릭=선택, 더블 클릭/눈 버튼=열기.

### 6a. 폴더 액션 & 다이얼로그
- 폴더 "⋯"/우클릭 컨텍스트 메뉴·다이얼로그 상세는 `folders-frontend.md`.

### 6b. 패널 토글 규칙 (Left / Right)
- Right 인스펙터 열기: 단일 클릭은 선택(하이라이트)만 한다. 문서/폴더 더블 클릭 또는 행 "눈" 버튼이 인스펙터를 연다. 폴더 더블 클릭은 진입이고 폴더 "눈" 버튼이 폴더 인스펙터를 연다.
- Right 인스펙터 닫기: PC는 패널 헤더 X 버튼, 모바일은 Sheet 닫기. 검색 결과 재렌더나 폴더 진입 시에도 닫힌다.
- 인스펙터는 선택 대상이 있을 때만 펼쳐지고, 열린 상태에서 다른 행을 선택하면 닫지 않고 해당 항목으로 내용을 갱신한다.
- Left 트리: AppHeader 토글로 접고/펼침, 접힘 상태 Zustand(`leftCollapsed`).
- 브레이크포인트: `≥md`는 패널 펼침/접힘, `<md`는 Left=`Sheet`(side=left)·Right=전체화면 `Sheet`(side=right)(§10).

## 7. 컴포넌트 선정·커스터마이징 전략
- shadcn/ui MCP로 적합 컴포넌트 탐색·선정, 커스터마이징은 Tailwind. 빌딩블록: Resizable, tree-view, dropzone→presigned PUT, Lucide.
- 도메인별 컴포넌트 매핑·API 바인딩은 각 `<domain>-frontend.md`.

## 8. 목록·업로드·원본 보기
- 상세는 `document-frontend.md`.

## 9. 검색·AI 산출물 UI
- 검색·RAG UI 상세는 `search-frontend.md`, AI 산출물(생성 트리거·산출물 내역·계보)은 `ai-outputs-frontend.md`.

## 10. 반응형 (PC/태블릿/모바일)
- PC·태블릿(`≥md` 768+): Left 트리 + Center 목록 + ResizablePanels. Left는 AppHeader 토글, Right는 row 클릭 토글(§6b).
- 모바일(`<md`): 단일 패널(Center) + Left=`Sheet`(side=left)·Right=전체화면 `Sheet`(side=right).
- 다이얼로그 풀스크린: 폰(`<sm`)에서만 Dialog를 전체화면(`w-screen h-dvh`, 라운드/마진 제거)으로 띄우고 콘텐츠를 상단 정렬한다. 패드/PC는 중앙 다이얼로그.
- 모바일 Sheet에는 닫기 버튼(X)을 두지 않는다(스와이프/오버레이로 닫음).
- 오버레이 `backdrop-blur`를 제거한다(렌더 부하 완화).
- 사이드바는 열림 애니메이션만 유지하고 닫힘 애니메이션은 제거한다(즉시 닫힘).
- 패널별 독립 스트리밍. 테마는 모든 브레이크포인트 공통(§1).

## 11. 운영 배포 전 TODO
- 브라우저→원격 MinIO presigned 호출 CORS
  - 해결: [ ]
  - 비고: 버킷 CORS 설정 필요(infrastructure §4 연계).
- 폴링 주기
  - 해결: [ ]
  - 비고: 인제스트·생성 폴링 간격 부하 보고 조정.

## 12. 라우팅 / 브라우저 히스토리
- App Router 경로별 page로 분리한다. 만능 catch-all(`[[...slug]]`)은 쓰지 않는다.
- 셸은 route group `(archive)`의 공유 `layout.tsx`로 유지한다(URL에 영향 없음). Center만 `{children}` 슬롯으로 교체되고 트리/인스펙터는 리마운트되지 않는다.
- URL이 현재 폴더와 검색의 진실 소스다. 서버 page가 async `params`/`searchParams`(Next 16)를 읽어 Center 컴포넌트에 prop으로 전달하므로 `useSearchParams` 훅이나 Suspense 경계가 필요 없다.
- 인스펙터 선택/하이라이트, 트리 펼침, 좌우 패널 토글, SearchBar 입력값은 Zustand가 유지한다(§5).
- 라우트 목록:
  - `/`는 `/my-archive`로 리다이렉트한다.
  - `/my-archive`는 루트 폴더 "내 아카이브" 목록을 연다.
  - `/folders`(키 없음)는 `/my-archive`로 리다이렉트한다.
  - `/folders/{folderKey}`는 해당 폴더 목록을 연다.
  - `/search?q=&mode=`는 검색 결과 화면을 연다(모드는 키워드/의미/rag).
  - 매칭되지 않는 경로는 전역 404(`app/not-found.tsx`, shadcn `Empty`)를 보여준다.
- 네비게이션은 `useRouter().push`와 헬퍼(`lib/routes.ts`의 `folderHref`/`searchHref`)로 수행한다.
- 검색 결과 화면의 뒤로가기는 `router.back()`이다(§9, search-frontend.md §4).
- `/folders/{folderKey}?doc={id}` 딥링크는 해당 폴더로 진입하면서 그 문서의 인스펙터를 함께 연다.
