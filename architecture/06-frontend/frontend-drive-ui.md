---
created: 2026-06-11
updated: 2026-06-11
status: draft
overview: Next.js 16/React 19 기반 3패널 Drive UI — 서버/클라 분리, 데이터·상태 관리, 컴포넌트, 반응형.
refs: research/04 §5
---

# 프론트엔드 (3-Panel Drive UI)

## 1. 범위
3패널 Drive UI: 서버/클라이언트 분리, 데이터·상태 관리, 컴포넌트, 반응형.
- 제품 표기명 **`Mechive`** — 브라우저 타이틀·헤더 브랜드. (저장소/버킷 식별자 `document-archive-refine`은 불변, 표시명만.)

## 2. 요구사항
3-Panel 레이아웃, 폴더/문서 CRUD, 업/다운로드, 검색·AI 산출물 UI, 라이트/다크 테마, PC/태블릿/모바일 3단 반응형.

## 3. 설계 결정
- react-query 1차 데이터 레이어 + Zustand UI 상태, RSC 셸 + Client 패널.
- 파일 업/다운로드는 원격 MinIO presigned 직접 호출(document). API는 `NEXT_PUBLIC_API_URL` 주입.
- 테마: `next-themes` + Tailwind `dark:` / shadcn CSS 변수 듀얼 토큰, 시스템 추종 + 수동 토글, FOUC 방지(`suppressHydrationWarning`).
- 반응형: PC/태블릿/모바일 3단(Tailwind `lg`/`md`). 상세 §12.

## 4. 전체 레이아웃 컴포넌트 맵
컴포넌트 트리·책임·상태 소유를 먼저 확정:
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
- DocumentList: shadcn `Table` + **TanStack Table 헤드리스**(`manualPagination`) + react-query(목록 + status/stage 폴링).
- DetailInspector: 토글형 — 문서/폴더 row 클릭으로 열림/닫힘, 닫기 버튼 없음.
- 반응형 합성(§12): `≥md`는 ResizablePanels 2패널(Left 트리 / Center 목록) + 토글형 Right, `<md`는 Center 단일 + Left=`Sheet`·Right=전체화면 `Sheet`(side=right). 모든 다이얼로그 모바일 전체화면. 동일 컴포넌트를 컨테이너만 바꿔 재사용.

## 5. 서버/클라이언트 분리
RSC: 페이지 셸·초기 패치(패널별 Suspense 스트리밍). Client(`"use client"`): 트리/드롭존/다이얼로그/인스펙터 토글 등 고상호작용.

## 6. 데이터 레이어
react-query(목록/상세/트리 + 파이프라인·생성 폴링 + 캐시·낙관 업데이트). RSC 초기 렌더는 `HydrationBoundary`로 시드. Server Actions는 선택(FastAPI와 로직 중복 금지).

## 7. UI 상태
선택/확장은 Zustand. 트리는 평면 리스트(folders §4)에서 `useMemo` 구성. 낙관 업데이트 후 실패 시 롤백.
- Zustand(클라 UI): `selectedFolderId`/`selectedDocumentId`, `expandedFolderIds`, 모바일 Sheet 개폐, 검색 입력값/모드. 선택 상태가 react-query 쿼리 키를 구동(예: `["documents", selectedFolderId]`).
- react-query(서버 데이터): 트리·목록·상세·검색 결과·생성 이력 + 폴링. 캐시·낙관·무효화.
- next-themes: 테마 — Zustand에 두지 않음(자체 persistence·SSR).
- 경계 원칙: 서버 출처면 react-query, 클라 전용(선택/토글/입력)이면 Zustand. 서버 데이터 Zustand 복제 금지.

### 7a. 인스펙터 표시 (읽기 전용 — MVP)
문서 본문은 편집하지 않는다(읽기 전용 보관함). AI 추출 메타(제목/요약/토픽/키워드)도 MVP는 보정 없이 읽기 전용 표시.
- 폴더 인스펙터(FolderDetail): Center 폴더 row **단일 클릭** 시 폴더 정보(이름·등록일·하위 수) 읽기 전용. (더블 클릭=진입, §8.)
- 소요 시간(성능 표시): MetadataView에 인제스트 소요(`documents.ingest_ms`, `documents-schema.md`), AI 산출물은 생성 소요(`generations.latency_ms`, `generations-schema.md`)를 초 단위로. 검색·RAG 소요는 각 다이얼로그 `elapsed_ms`(§11).
- AI 산출물 계보(Lineage) 섹션: 산출물 문서(= 어떤 생성의 `output_document_id`)면 계보 표시 — 부모 문서 링크(클릭=Center 이동)·종류·모델/provider/seed·생성 소요·프롬프트(접기)·인용 출처. 데이터=`GET /generations/{id}/lineage`(ai-outputs §10). 일반 업로드 문서엔 미표시.

## 8. 패널 구성 (Left 트리 / Center 목록 / Right 토글 인스펙터)
- Left: 폴더 트리 + CRUD/MOVE. 각 행 "⋯" 드롭다운(§8a). 접기/펼치기는 AppHeader 토글(§8b, 패널 헤더에 닫기 버튼 없음).
- Center: 문서 목록 전용(Google Drive식 — 하위 폴더 row + 문서 row, 폴더 먼저). 폴더 row: 단일=인스펙터 토글(§7a)·더블=진입, "⋯" FolderActions(§8a). 문서 row: 클릭=인스펙터 토글(§8b). 업로드 영역 MVP 미노출(컴포넌트 보존).
- Right = DetailInspector(토글형 §8b): 문서=상세(status/stage·원본 보기 §10)+메타(§7a)+생성 트리거·"산출물 내역"(ai-outputs); 폴더=FolderDetail(§7a). Center·Right 기능 중복 없음, 개폐는 row 클릭 토글.

### 8a. 폴더 액션 & 폴더 다이얼로그
- 폴더 "⋯" DropdownMenu(공용 `FolderActions`, Left·Center 양쪽): 이동/이름변경/삭제. 트리 상단/루트엔 "새 폴더".
- 우클릭 컨텍스트 메뉴(shadcn `context-menu`): 동일 액션(폴더=이동/이름변경/삭제, 파일=상세/다운로드/삭제), "⋯"와 핸들러 공유.
- NewFolderDialog: `POST /folders {parent_id?, name}`(folders §7), 형제 중복명 409 인라인.
- RenameFolderDialog: 현재명 pre-fill → `PATCH /folders/{id} {name}`(folders §7).
- MoveFolderDialog: 폴더 트리 표현 + 대상 상위 선택 → `PATCH /folders/{id} {parent_id}`(folders §5 MOVE). 자기 자신·후손 선택 비활성(사이클 422 사전 차단).

### 8b. 패널 토글 규칙 (Left / Right)
- Right 인스펙터: 항상 노출이 아니라 토글 — 문서 row 클릭/폴더 row 단일 클릭으로 열고, 같은 row 재클릭 시 닫힘. 상태는 Zustand 선택 항목(`selected: {kind:'doc'|'folder', id} | null`). 폴더 더블 클릭=진입(§8). 패널에 닫기 버튼 없음.
- Left 트리: AppHeader 토글로 접고/펼침, 접힘 상태 Zustand(`leftCollapsed`).
- 브레이크포인트: `≥md`는 패널 펼침/접힘(Left는 AppHeader로 재오픈), `<md`는 Left=`Sheet`(side=left)·Right=전체화면 `Sheet`(side=right) 개폐(§12).

## 9. 컴포넌트 선정·커스터마이징 전략
- shadcn/ui MCP로 적합 컴포넌트 탐색·선정, 커스터마이징은 Tailwind. 빌딩블록: Resizable, tree-view, dropzone→presigned PUT, Lucide.
- DocumentList: shadcn `Table` + **TanStack Table v8 헤드리스**(`useReactTable`/`getCoreRowModel`, `manualPagination: true`) — 서버사이드 페이지네이션 기준, 목록 계약 `GET /documents?folder_id=&limit=&cursor=`(document §5) + react-query 바인딩. API·옵션은 context7 MCP로 v8 최신 문서 확인 후 작성.

## 10. 목록(Google Drive식) + 업로드/다운로드 + 원본 보기
- 목록: 하위 폴더 행 + 문서 행(폴더 먼저). 폴더 행: 단일=인스펙터 토글(§7a)·더블=진입, 문서 행 클릭=Right 토글(§8b). AI 산출물도 일반 문서 행으로 표기(ai-outputs §9). 좌우 패딩, 목록 헤더 상단 border 없음.
- 업로드: presigned 3단계(document) UX 유지하되 MVP UI 미노출(`UploadDropzone` 보존). 진행률 + 인제스트 `status/stage` 폴링(ready/failed 정지).
- 원본 미리보기 영역 없음. DocumentDetail에 "원본 보기" 버튼만:
  - 텍스트류(`text/markdown`·`text/plain`): `OriginalViewerDialog` 마크다운 뷰어(인앱 열람).
  - 그 외(PDF·이미지·바이너리): presigned GET 다운로드(인앱 렌더 안 함).
- 표시 날짜는 등록일(`created_at`)만 — 인앱 편집 없어 "수정일" 무의미(`updated_at`·`doc_modified_at`은 내부 보존·미노출).

## 11. 검색·AI 산출물 UI
출력물이 다르므로 분리(역할 혼선 방지):
- 검색 다이얼로그 = retrieval: `POST /search`(search-and-rag §11) → 문서/청크 결과 리스트. 모드 선택 UI 없이 항상 하이브리드 고정, 모드 뱃지 없음. 결과·인용 클릭 → 원문 딥링크. 검색 소요(`elapsed_ms`) 표시.
- "RAG 질문" = RAG QA: `POST /search/ask`(search-and-rag §11) → 합성 답변 1개 + 인용 `[n]`. 라벨 "RAG 질문". 프롬프트 입력은 auto-grow textarea(Enter=전송/Shift+Enter=줄바꿈). RAG 전체 소요(`elapsed_ms`) 표시.
- (`rag`는 search-and-rag §7 라우터 intent일 뿐, 검색 결과 리스트의 모드 아님.)
- AI 산출물 = 1급 문서(ai-outputs §9): 요약/초안/보고서는 문서로 저장돼 Center 목록·검색·RAG에 일반 문서처럼 포함. 생성 트리거 + "산출물 내역"은 Right 인스펙터: row 클릭 → Center가 산출물 문서 폴더로 이동·선택, 출력 문서 삭제 시 내역에서 사라짐(`output_document_id` SET NULL).

## 12. 반응형 (PC/태블릿/모바일)
- PC·태블릿(`≥md` 768+): Left 트리 + Center 목록 + ResizablePanels. Left는 AppHeader 토글, Right는 row 클릭 토글(§8b). 태블릿 동일 구성(폭 축소).
- 모바일(`<md`): 단일 패널(Center) + Left=`Sheet`(side=left)·Right=전체화면 `Sheet`(side=right). 개폐 Left=AppHeader, Right=row 클릭 토글.
- 다이얼로그 풀스크린: 모든 Dialog는 모바일에서 전체화면(`<md` 시 `w-screen h-dvh`·라운드/마진 제거), 콘텐츠 상단 정렬 flex column으로 수직 중앙 "붕 뜸" 방지.
- 패널별 독립 스트리밍. 테마는 모든 브레이크포인트 공통(§3).

## 13. 운영 배포 전 TODO
- 브라우저→원격 MinIO presigned 호출 CORS
  - 해결: [ ]
  - 비고: 버킷 CORS 설정 필요(infrastructure §5 연계).
- 폴링 주기
  - 해결: [ ]
  - 비고: 인제스트·생성 폴링 간격 부하 보고 조정.
