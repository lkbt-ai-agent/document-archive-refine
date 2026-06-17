---
created: 2026-06-11
completed: —
overview: 백엔드 착수 전 UI/데이터 흐름 확정 + 클릭 가능한 목업 프로토타입으로 동선 검수(라이트/다크·3단 반응형 전제, frontend).
---

> UI 컴포넌트 탐색·추가는 shadcn MCP, 라이브러리·API 버전은 context7 MCP로 확인.

## 설계 검증
- [x] A1 컴포넌트 맵 검증 — 누락/변경만 arch 역반영 (frontend §2).
- [x] A2 와이어프레임 — 저충실도 ASCII, 고충실도는 C1 (§10).
- [x] A3 상태 소유 — react-query(서버) vs Zustand(UI) 경계 (§4·§5).
- [x] A4 API 계약 점검 — 도메인 문서 엔드포인트 갭 arch 역반영.
- [x] A5 디자인 토큰 — 라이트/다크 듀얼 토큰 + shadcn 후보, 값은 B2 이후 (§7·§1).
- [x] A6 presigned 3단계 업/다운로드 UX (document §3).

## 스캐폴드
- [x] B1 Next.js 스캐폴드 (`create-next-app`, 프로젝트명 `web`).
- [x] B2 shadcn/ui 초기화.

## 구현 기능 (프로토타입 구현완료)

### 셸·레이아웃·테마
- 3패널 셸: Left 폴더 트리 / Center 목록·검색 결과 / Right 인스펙터.
- 라이트/다크/시스템 테마 토글(next-themes).
- 3단 반응형: PC·태블릿=3패널(ResizablePanels), 모바일=단일 패널 + Sheet.
- 헤더 고정 높이(SearchBar가 늘어나도 헤더·레이아웃 불변).

### 헤더·SearchBar
- 브랜드 "Mechive" — "Me"를 primary 배경 배지로 강조.
- 좌측 패널 토글(모바일=Sheet 열기 / PC=접기·펼치기).
- 통합 SearchBar(textarea) + "검색..." 모드 드롭다운(키워드/의미/rag).
- Enter=모드 드롭다운, Shift+Enter=줄바꿈, 한글 IME 조합 중 Enter 무시.
- `≥md`에서 SearchBar 중앙 정렬.
- 모바일 포커스: 다른 헤더 요소 가리고 전체 폭 차지, blur 시 원복.
- 모바일 blur 시 한 줄로 접힘 / 포커스 시 입력 전체 줄 표시.

### 좌측 폴더 트리
- 폴더 트리 + 펼치기/접기.
- 행 "⋯" 드롭다운(이동/이름변경/삭제) + 우클릭 컨텍스트 메뉴(공용 `FolderActions`).
- 모바일은 "⋯" 항상 노출(hover 불가).
- 새 폴더/이름변경/이동/삭제 다이얼로그.
- 루트("내 아카이브")는 액션·컨텍스트 메뉴 미노출.

### Center 문서 목록 (Google Drive식)
- shadcn Table + TanStack v8 서버 페이지네이션.
- 하위 폴더 row + 문서 row(폴더 먼저), AI 산출물도 일반 문서 row로 표기.
- 컬럼: 이름 / 상태 / 크기 / 등록일(폴더는 상태·크기 "—").
- 행 "⋯" 드롭다운(문서=다운로드/삭제, 폴더=폴더 액션) + 우클릭 컨텍스트 메뉴.
- 업로드(`UploadDropzone`) 컴포넌트 보존, MVP UI 미노출.

### 우측 인스펙터 (DetailInspector)
- 문서: 상세(크기/형식/페이지/작성자/등록일/처리 시간) + 원본 보기·다운로드 + 메타데이터/산출물 탭.
- 폴더: 이름/등록일/하위 수.
- "문서 상세" 헤더만 고정, 아래 전체를 단일 스크롤.
- AI 메타데이터 읽기 전용.
- 산출물 문서면 계보 섹션(원본 링크·모델/provider/seed·프롬프트 접기).
- 원본 보기 분기: 텍스트류=인앱 마크다운 뷰어 / 그 외=presigned GET 다운로드.

### 선택·열기·닫기 인터랙션
- 단일 클릭=선택(하이라이트만); 인스펙터가 열려 있으면 닫지 않고 해당 항목으로 내용 갱신.
- 문서 더블 클릭 / 행 "눈" 버튼=인스펙터 열기.
- 폴더 더블 클릭=진입(인스펙터 아님), 폴더 "눈"=폴더 인스펙터 열기.
- 닫기: PC=헤더 X 버튼 / 모바일=Sheet 닫기 / 검색 재렌더 / 폴더 진입.
- 인스펙터는 선택 대상이 있을 때만 펼침(Center 재렌더 시 자동 닫힘).

### 검색·RAG 결과 화면
- 결과는 Center 본문에 렌더(조회 ↔ 결과 화면 전환), 제목 옆 뒤로가기.
- 로딩 표시 후 결과; 공통 메타(응답 시간 + 결과 수/인용 수).
- 키워드/의미: 문서 목록 table 디자인 리스트 + 행 밑 청크 정보 subrow(카드, 전체 표시).
- rag: 합성 답변 + 인용 출처, 답변 내 `[n]` 클릭=출처로 이동.
- 결과 행: 단일=선택, 더블/눈=인스펙터, "⋯"·우클릭 메뉴(다운로드/해당 폴더로 이동/삭제).
- "해당 폴더로 이동"=폴더 이동 + 해당 문서 선택.

### AI 산출물·계보
- 생성 트리거 다이얼로그(요약/초안/보고서).
- "산출물 내역"(원본 기준), 행 클릭=산출물 문서로 이동.
- 계보 부모 문서 링크 클릭=Center 이동·선택.
- 산출물은 1급 문서로 목록·검색에 포함, 생성 소요 시간 표시.

### 상태 흐름·알림 (목업 시뮬레이션)
- 인제스트 폴링: `status`/`stage`(extracting→generating_meta→chunking→embedding) → ready=메타·소요(`ingest_ms`) / failed=`error` 표시·정지.
- 비동기 생성: `queued`→`running`→`succeeded`(산출물 등장) / `failed`.
- Toaster(sonner): position `top-center`, 배경색 없이 타입 아이콘으로 성공/실패 구분.

### 다이얼로그·시트 공통
- 다이얼로그 풀스크린: 폰(`<sm`)만, 패드·PC는 중앙 다이얼로그.
- 모바일 Sheet 닫기 버튼(X) 제거(스와이프/오버레이로 닫기).
- 오버레이 `backdrop-blur` 제거(렌더 렉 완화).
- 사이드바: 열림 애니메이션 유지 + 닫힘 애니메이션 제거(즉시 닫힘).

### 개발 구동
- [x] C2 `web/README.md` — dev 구동 명령 + 가동 전 `npm run lint`.
- [x] C3 Tailscale dev 접속 — `next.config.ts` `allowedDevOrigins` tailnet 한정·공개 금지 (document-backend §7).

## URL 라우팅 / 브라우저 히스토리 (L)
> 현재: 단일 `app/page.tsx` + Zustand만 → URL·히스토리 없음(앞/뒤로가기 불가).
> 방침: **경로별 page로 분리**(만능 catch-all `[[...slug]]` 금지), 셸은 공유 layout으로 유지. 폴더/검색의 진실 소스는 URL, 인스펙터·UI 토글·검색 입력값은 Zustand.

### 라우트 구조
- `app/layout.tsx` — 루트(html/body/providers), 그대로 유지.
- `app/page.tsx` — `/` → `redirect("/my-archive")`.
- `app/(archive)/layout.tsx` — 공유 셸(AppHeader + Left 트리 + Center 슬롯 `{children}` + Right 인스펙터 + 모바일 Sheet). route group `(archive)`은 URL에 영향 없음. 네비게이션 간 유지(트리·인스펙터 비리마운트).
- `app/(archive)/my-archive/page.tsx` — `/my-archive` 루트 폴더(내 아카이브) → Center = `<DocumentList folderId="root" />`.
- `app/(archive)/folders/page.tsx` — `/folders`(key 없음) → `redirect("/my-archive")`.
- `app/(archive)/folders/[folderKey]/page.tsx` — `/folders/{folderKey}` → Center = `<DocumentList folderId={folderKey} />`.
- `app/(archive)/search/page.tsx` — `/search?q=&mode=` → Center = `<SearchResults q mode />`.
- `app/not-found.tsx` — 매칭 안 되는 모든 경로의 전역 404(shadcn `Empty` + "내 아카이브로 이동").

### 책임 분리
- 폴더/검색 상태 = URL. 서버 page가 `params`/`searchParams`(Next 16 async, context7 확인)를 읽어 Center 컴포넌트에 prop으로 전달 → `useSearchParams` 훅·Suspense 경계 불필요.
- 인스펙터(문서/폴더 선택·하이라이트)·트리 펼침·좌우 패널 토글·SearchBar 입력값 = Zustand 유지.
- store에서 폴더/검색 화면 상태 제거: `selectedFolderId`·`searchActive`·`searchMode`·`searchSubmittedQuery`·`searchNonce`·`runSearch`·`closeSearch`(=URL로 대체). 현재 폴더는 `useCurrentFolderId`(`useParams`/`usePathname`) 파생.

### 항목 (구현 완료)
> 라우트·책임 분리는 위 두 절 참고. 여기선 설계에 없는 구현 세부만 기록.
- 셸: `(archive)/layout.tsx`가 `DriveShell` 렌더, Center=`{children}` 슬롯(`DriveApp`·`CenterPanel` 스위처 제거).
- 컴포넌트 prop화: `DocumentList`(`folderId`/`docId`)·`SearchResults`(`q`/`mode`) store 의존 제거.
- 네비게이션: 폴더 진입·검색·폴더 이동·계보/산출물 이동=`useRouter().push`(`lib/routes.ts` `folderHref`/`searchHref`), 로고·좌측 "내 아카이브" 클릭=`/my-archive`.
- 히스토리 정합: 라우트 전환 시 `resetSelection`로 인스펙터 닫힘, 검색 뒤로가기=`router.back()`, `/folders/{key}?doc={id}` 딥링크로 문서 인스펙터 동반.
- [x] L6 검증(사용자): 앞/뒤로가기·딥링크·새로고침 동작 확인.

> 🚦 검색은 단일 진입(키워드/의미/rag, 결과는 Center) 모델로 개정. 정본은 search-frontend.md, Phase 2 구현은 04-frontend C1.

## architecture/06-frontend 반영 계획 (M)
> 위 "구현 기능"·"URL 라우팅(L)"에서 확정된 동선을 `architecture/06-frontend/*.md`에 반영. 2026-06-17 반영 완료(5개 파일 `updated: 2026-06-17`).

### 반영 방법
- 파일별로 신규 동선을 기존 절에 흡수하거나 새 `## n.`(append-only)로 추가한 뒤, 절 내부를 기능별로 `###`/bullet로 재분할.
- 프로토타입이 arch와 어긋난 항목(인터랙션 §6b, 상태 경계 §5)은 arch를 프로토타입 확정안으로 갱신(폐기 표현은 삭제).
- arch 규약 준수: `—`·`·` 미사용, `## n.`는 stable ID라 재번호 금지(추가만), 상위 레이어만 참조.

### frontend.md
- [x] §1·§2: 브랜드 "Mechive"("Me" 배지), 로고 클릭=`/my-archive`, 루트 폴더명 "내 아카이브" 반영.
- [x] §1 또는 §10: 헤더 고정 높이(SearchBar가 늘어나도 헤더·레이아웃 불변) 추가.
- [x] 신규 `## 12. 라우팅/히스토리`: 경로별 page 분리(catch-all 금지), route group `(archive)`+공유 layout, URL=폴더/검색 진실 소스(서버 page가 async `params`/`searchParams`를 Center prop으로 전달), 인스펙터·토글·입력값=Zustand. 라우트 표(`/`·`/folders`→`/my-archive`, `/my-archive`, `/folders/[folderKey]`, `/search`, 전역 404).
- [x] §5: Zustand 키에서 `selectedFolderId`·검색 화면 상태 제거, "현재 폴더/검색=URL(`useCurrentFolderId` 파생)" 경계로 갱신.
- [x] §6b: "단일=선택(하이라이트), 더블/눈=인스펙터 열기, PC=X 버튼·모바일=Sheet 닫기"로 갱신("재클릭 토글"·"닫기 버튼 없음" 폐기). 인스펙터는 선택 대상 있을 때만 펼치고 Center 재렌더 시 닫힘.
- [x] §10: 다이얼로그 풀스크린 범위 `<md`에서 폰(`<sm`)으로 축소, Sheet X 제거·`backdrop-blur` 제거·사이드바 닫힘 애니메이션 제거 추가.
- [x] §2 Toaster: position `top-center`, 배경색 없이 아이콘으로 성공/실패 구분.

### document-frontend.md
- [x] §1: 컬럼(이름/상태/크기/등록일, 폴더는 상태·크기 대시 자리표시 `-`) + 폴더 우선 정렬 명시, 행 단일=선택·더블/눈=인스펙터·"⋯"/우클릭 메뉴로 갱신.
- [x] §3: 인스펙터 단일 스크롤("문서 상세" 헤더만 고정), 메타데이터/산출물 탭, 텍스트류=인앱 마크다운·그 외=presigned GET 분기 반영.

### folders-frontend.md
- [x] §1·§3: 폴더 row 단일=선택(하이라이트)·더블=진입·"눈"=폴더 인스펙터로 갱신("단일=인스펙터 토글" 폐기), 루트("내 아카이브") 액션·컨텍스트 메뉴 미노출, 모바일 "⋯" 항상 노출 추가.

### search-frontend.md
- [x] §3a: 청크 subrow를 카드형(여백 적게, 전체 표시, 과한 색조 금지)으로 명시.
- [x] 신규 결과 row 액션: "⋯"/우클릭 메뉴(다운로드/해당 폴더로 이동/삭제), "해당 폴더로 이동"=폴더 이동+문서 선택, row 클릭=인스펙터 토글.
- [x] §2: 한글 IME 조합 중 Enter 무시, `≥md` 중앙 정렬, 모바일 포커스 전체 폭·blur 시 한 줄 접힘 추가.
- [x] §4·§5: 결과 화면=URL(`/search?q=&mode=`)·뒤로가기=`router.back()`로 갱신, §5의 "결과 화면 표시 여부 Zustand" 제거(URL 대체).

### ai-outputs-frontend.md
- [x] §2·§3: 산출물 내역 row 클릭·계보 부모 링크 이동을 `useRouter().push(folderHref(..., docId))` URL 이동으로 명시(딥링크로 해당 문서 인스펙터 동반).
