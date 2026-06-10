---
status: active
scope: mvp
phase: 1
arch_ref: architecture/10-frontend-drive-ui.md
index: plan.md
---

# Phase 1 — 프론트엔드 설계 + UI 프로토타입 (arch 10)

> 공통 규약(전역 제약·구현 규약·코드 스타일)은 [plan.md](./plan.md) 참조.

백엔드 착수 전 UI/데이터 흐름을 먼저 확정해 API 계약을 역으로 검증하고, **클릭 가능한 UI 프로토타입**으로 동선을 시각 검수.
설계 전반에 **라이트/다크 테마 + PC/태블릿/모바일 3단 반응형**을 전제로 한다(arch 10 §2·§3·§12 반영 완료).

> **산출물 정책(중복 방지):** `architecture/`가 SoT. 1.1~1.6은 **재문서화가 아니라 검증 게이트**다. 새 설계 문서를 만들지 않고 산출물을 흘려보낸다 — 검증 델타(1.1·1.3)는 **arch에 역반영**, API 갭(1.4)은 **arch 05~09 패치**, 토큰 값(1.5)은 **1.8 이후 코드**(`globals.css`/theme), 와이어프레임(1.2)은 **1.9 프로토타입 코드로 흡수**. 영구 신규 산출물은 `web/` 코드뿐.

- [x] 1.1 컴포넌트 맵 **검증** — AppShell(RSC) → ResizablePanels → Left/Center/Right + Search, arch 10 §4 대비 누락/변경만 arch 역반영 (재작성 금지)
- [x] 1.2 와이어프레임 — **저충실도 ASCII/마크다운 레이아웃 스케치**(PC·태블릿 3패널 / 모바일 단일+Sheet·Drawer), 1.9의 입력 스펙(고충실도=1.9 프로토타입 자체) (§12)
- [x] 1.3 상태 소유 **검증** — react-query(서버 데이터) vs Zustand(선택/확장) 경계, arch 10 §6·§7 대비 확정
- [x] 1.4 API 계약 목록화 — 05~09의 엔드포인트를 프론트 관점에서 점검, 누락/불일치는 **arch 05~09에 피드백 반영**
- [x] 1.5 디자인 토큰/Tailwind 4 테마 — **라이트/다크 듀얼 토큰**(shadcn CSS 변수) + shadcn 컴포넌트 후보 선정(MCP 탐색), **구체 토큰 값은 1.8 이후 코드에 적용** (§9·§3)
- [x] 1.6 presigned 3단계 업/다운로드 UX 플로우 정의 (arch 06 §4 정합)
- [x] 1.7 Next.js 스캐폴드 — `npx create-next-app@latest web --yes` (프로젝트명 `web`, plan 2.7 서비스명 정합)
- [x] 1.8 shadcn/ui 초기화 — `npx shadcn@latest init --preset b6F9PilA8 --template next`
- [x] 1.9 UI 프로토타입 구현 — 1.1~1.6 설계 반영, 3패널 셸 + 핵심 동선(폴더 트리·문서 목록/상세·업로드·검색/생성)을 **목업 데이터로** 클릭 가능하게 (백엔드 미연동). **라이트/다크 토글(`next-themes`) + 3단 반응형(PC/태블릿/모바일) 포함**
  - [x] 1.9a `web/README.md` 작성 — **개발 서버 구동 명령어만 간략히**(`npm run dev`). **테스트 직후 가동 시 반드시 `npm run lint` 선행 호출**하도록 명시. (그 외 장황한 설명 금지)
  - [x] 1.9b **원격(Tailscale) dev 서버 접속 설정** — 게이트 검수를 Mac mini의 Tailscale 호스트(`http://xxx-macmini.tail902fcf.ts.net:3000/`)로 수행하기 위한 dev 전용 설정. (Phase 4 dev에서도 재사용)
    - **`web/next.config.ts` — `allowedDevOrigins` 추가(필수):** Next.js 16은 기본적으로 localhost 외 origin의 dev 전용 자산/엔드포인트(HMR 등) cross-origin 요청을 **차단**한다. Tailscale 호스트를 허용 목록에 등록.
      ```ts
      // next.config.ts
      const nextConfig: NextConfig = {
        allowedDevOrigins: ["xxx-macmini.tail902fcf.ts.net", "*.tail902fcf.ts.net"],
      };
      ```
      (`web/node_modules/next/dist/docs/01-app/.../allowedDevOrigins.md` 근거. 운영(`next start`)에는 미적용 — dev 전용.)
    - **바인딩(보통 불필요):** `next dev`는 이미 전 인터페이스 바인딩(기동 로그 `Network:` URL 노출 → Tailscale 100.x 인터페이스로 도달 가능). 미노출 시에만 `package.json`의 dev 스크립트를 `next dev -H 0.0.0.0`으로 명시.
    - **전제(코드 외):** Mac mini에서 Tailscale 실행 + MagicDNS로 호스트명 해석, macOS 방화벽에서 `node` 인바운드 허용(또는 방화벽 off). 시크릿 아님(호스트명만) → `.env` 무관.
    - **보안:** dev 서버를 tailnet에 노출하는 것이므로 tailnet ACL 신뢰 범위 내로 한정. 공개 인터넷 노출 금지(운영은 reverse proxy + TLS, arch 06 §10 정합).
- [x] 1.10 **프로토타입 개정 (1.9 게이트 1차 검수 피드백)** — 아래 개정을 1.9 프로토타입 코드에 반영 후 재검수. 설계 변경은 arch에 역반영 완료(각 항목 참조). 코드 스타일은 상단 **코드 스타일 규약** 준수.
  - [x] 1.10.1 **하단(Center 상세) 패널 제거 → 우측 패널로 통합.** Center는 문서 **목록 전용**. 상세 정보는 Right(DetailInspector)로 이관, **중복 기능 추가 금지**. **미리보기 영역 삭제**하고 **"원본 보기" 버튼**만: 텍스트류=마크다운 뷰어 다이얼로그, 그 외=presigned 다운로드. (arch 10 §4·§8·§10)
  - [x] 1.10.2 **우측 패널 토글화** — 문서 row **선택** 또는 row **"⋯" 클릭** 시에만 열림(선택 해제 시 접힘). 참고 UX: shadcn `sidebar-demo`(base-nova). (arch 10 §8b)
  - [x] 1.10.3 **등록일만 표시** — 문서는 인앱 편집이 없으므로 **수정일 비노출**, `created_at`(등록일)만 화면 표기. (arch 10 §10, arch 03 주석)
  - [x] 1.10.4 **앱 타이틀 `Mechive`** — 브라우저 `<title>`/메타데이터·헤더 브랜드. (저장소·버킷명은 불변, 표시명만) (arch 10 §1)
  - [x] 1.10.5 **새 폴더 다이얼로그** 프로토타입 — 이름 입력 → `POST /folders`. (arch 10 §8a, arch 05 §8)
  - [x] 1.10.6 **좌측 폴더 "⋯" 드롭다운** — 폴더 행마다 **이동/이름 변경/삭제** 메뉴. (arch 10 §8a)
  - [x] 1.10.7 **폴더 이동 다이얼로그** 프로토타입 — **폴더 트리 구조 표현 + 옮길 대상 상위 폴더 선택** 동선(자기·후손 비활성, 사이클 방지). `PATCH /folders/{id} {parent_id}`. (arch 10 §8a, arch 05 §6) *(요청 표기는 "이름 변경 다이얼로그"였으나 기술된 동선=MOVE이므로 이동 다이얼로그로 해석. 이름 변경 다이얼로그는 1.10.6의 별도 항목으로 분리.)*
  - [x] 1.10.8 **메타데이터 읽기 전용 표시(보정 MVP 제외)** — AI가 생성한 메타(제목/요약/토픽/키워드)를 **input/저장 없이 그대로 표시**. 우측 패널 `MetadataEditor`→**읽기 전용 뷰**로 전환. 오입력 보정 방식(수동 입력 vs AI 프롬프트)은 **추후 결정**. 사례 분석은 `research/01-document-processing.md §8`로 이관. (arch 10 §7a)
  - [x] 1.10.9 **모든 다이얼로그 모바일 풀스크린** — `<md`에서 Dialog 전체 화면(`w-screen h-dvh`, 라운드/마진 제거), 데스크톱은 중앙 모달. (arch 10 §12)
- [x] 1.11 **프로토타입 개정 (1.10 게이트 2차 검수 피드백 — Google Drive식 정렬)** — 아래를 1.9/1.10 프로토타입 코드에 반영 후 재검수. 설계 변경은 arch 10에 역반영(각 항목 참조). 순수 스타일링은 코드에만 반영. 코드 스타일 규약 준수.
  - [x] 1.11.1 **목록에 하위 폴더 row 렌더(Google Drive식)** — 현재 폴더에 하위 폴더가 있으면 Center 문서 목록에 **하위 폴더 행을 함께 표기**(폴더 먼저, 문서 다음). 폴더 행 클릭 = 해당 폴더로 진입(`selectFolder`). 참고: 1차 피드백 이미지(폴더+파일 혼합 목록). (arch 10 §4·§8·§10)
  - [x] 1.11.2 **업로드 영역 UI 제거** — Center 상단 `UploadDropzone` 노출 제거. **컴포넌트 파일(`upload-dropzone.tsx`)은 삭제하지 않고 보존**(추후 업로드 진입점에서 재사용). (arch 10 §4·§10)
  - [x] 1.11.3 **Center 좌우 패딩** — 문서 목록이 패널 가장자리에 붙지 않도록 좌우 패딩 부여. (스타일링, 코드 전용)
  - [x] 1.11.4 **Center 상단 border 제거** — 목록 헤더 위쪽 경계선 삭제. (스타일링, 코드 전용)
  - [x] 1.11.5 **좌/우 패널 헤더 토글 버튼** — Left·Right **각 패널 헤더에 패널 토글 버튼**을 두어 **PC·모바일 모두** 접고/펼침. 우측은 기존 선택 기반 노출(§8b)에 더해 헤더 토글도 지원. 참고 UX: shadcn `sidebar-demo`(base-nova). (arch 10 §8·§8b·§12)
  - [x] 1.11.6 **모바일 풀스크린 다이얼로그 콘텐츠 정렬 수정** — `<md` 전체 화면 시 내용물이 수직 중앙으로 "붕 뜨는" 문제 수정: 콘텐츠를 **상단 정렬 flex column**으로 화면을 채워 배치(`dialogMobileFullscreen` 보강). 참고: 2차 피드백 이미지(검색 다이얼로그). (arch 10 §12)
  - [x] 1.11.8 **검색 / AI 질문 역할 분리** — 두 동선의 출력물이 다름을 명확히: **검색 다이얼로그 = retrieval(결과 리스트)**, **AI 질문 = RAG(생성 답변 + 인용)**. 검색 다이얼로그의 **"RAG" 모드 배지 제거** → `키워드/의미`(필요 시 하이브리드) **결과 리스트 전용**(`POST /search`, arch 08 §12). RAG 생성 답변은 "AI 질문"(`POST /search/ask`)에만 둠. (`rag`는 §8 GBNF 라우터 intent일 뿐 결과 리스트 모드가 아님.) (arch 10 §11, arch 08 §12) *(모드 뱃지는 1.12.4에서 하이브리드 고정으로 대체.)*
  - [x] 1.11.9 **AI 질문(RAG) 프롬프트 입력 = 자동 개행 textarea** — 단일 행 input 대신 **자동 높이 조절 `textarea`**: 초기 1줄, 입력 길이에 따라 자동 개행·확장하되 **최대 n줄(예: 6줄)에서 멈추고 그 이상은 내부 스크롤**. (CSS `field-sizing: content` + `max-height`/`rows` 또는 동등 auto-grow.) Enter=전송, Shift+Enter=줄바꿈. (arch 10 §11)
  - [x] 1.11.7 **목록 테이블 = shadcn ui + headless TanStack Table** — DocumentList를 shadcn `Table`(프레젠테이션) + **TanStack Table(`@tanstack/react-table`) 헤드리스 코어**로 구현. **서버사이드 페이지네이션 기준**(`manualPagination`, 정렬·필터도 서버 위임 가능) — 기존 목록 계약 `GET /documents?folder_id=&limit=&cursor=`(arch 06 §5, cursor/keyset) + react-query에 바인딩. **context7 MCP로 TanStack Table v8 최신 API(`useReactTable`/`getCoreRowModel`/`manualPagination`) 확인 후 설계·구현**(메모리 의존 금지). 하위 폴더 row(1.11.1)는 동일 테이블의 행 종류로 표현. 프로토타입(목업)은 클라이언트 슬라이스로 페이지네이션 흉내, Phase 4에서 실 API 배선. (arch 10 §4·§9·§10)
- [x] 1.12 **프로토타입 개정 (1.11 검수 피드백)** — 아래를 프로토타입 코드에 반영 후 재검수. 설계 변경은 arch 10에 역반영(각 항목 참조). 코드 스타일 규약 준수.
  - [x] 1.12.1 **우측 패널 모바일 = 전체 화면 사이드바** — 모바일(`<md`)에서 우측 인스펙터를 **바텀 시트(Drawer)가 아니라 전체 화면 `Sheet`(side="right")**로 표시. (arch 10 §8b·§12)
  - [x] 1.12.2 **우측 패널 row 클릭 토글** — 문서 row 클릭 시 인스펙터 **열림/닫힘 토글**(같은 row 재클릭 시 닫힘). 현재 PC에서 열림은 되나 **닫힘이 안 되는** 문제 수정 — 같은 `id` 재선택 시 `selectedDocumentId`를 `null`로. (arch 10 §8b)
  - [x] 1.12.3 **좌/우 패널 헤더 닫기 버튼 삭제** — 1.11.5에서 추가한 좌측(`PanelLeftClose`)·우측(`PanelRightClose`) **패널 헤더 토글 버튼 제거**. 좌측 개폐는 **AppHeader 토글**, 우측 개폐는 **row 클릭 토글(1.12.2)·모바일 Sheet 닫기**로 일원화. (arch 10 §8·§8b)
  - [x] 1.12.4 **검색 = 하이브리드 고정 (모드 뱃지 제거)** — 검색 다이얼로그의 `키워드/의미/하이브리드` **선택 UI 제거**, `/search`는 **항상 하이브리드(§6 RRF)**로 호출. 근거: §8 GBNF 라우터는 **LLM 분류**라 단순 용어("계약서")에도 LLM 호출+비결정적 분기를 유발 → 단순 retrieval엔 과함. 하이브리드 RRF가 **키워드(PGroonga 정확매칭) + 벡터(의미)**를 이미 융합하므로 결정적·견고. 자동 라우팅(의도 분류·날짜/`owner_id` 추출)은 **`/search/ask`(AI 질문)에만**. `mode?` API 파라미터는 **평가(§11)·향후 override용으로 백엔드에 유지하되 UI 미노출**. *(1.11.8의 모드 뱃지 결정을 대체.)* (arch 10 §11, arch 08 §12)
- [ ] 1.13 **프로토타입 개정 (1.12 검수 피드백)** — 아래를 프로토타입 코드에 반영 후 재검수. 설계 변경은 arch에 역반영(각 항목 참조). 코드 스타일 규약 준수.
  - [ ] 1.13.1 **Center 폴더 row "⋯" 드롭다운 추가** — 가운데 패널 폴더 행에도 **이동/이름변경/삭제** 드롭다운(좌측 트리는 이미 1.10.6에 있음). 좌/우 공용 **`FolderActions`** 컴포넌트로 추출해 재사용. (arch 10 §8a·§4·§10)
  - [ ] 1.13.2 **Center 폴더 row 클릭 동작 분리** — **단일 클릭 = 우측 인스펙터에 폴더 메타데이터 토글**, **더블 클릭 = 해당 폴더로 진입(하위 목록)**. 우측 인스펙터가 **문서/폴더 양쪽**을 다루도록 확장(폴더는 이름·등록일·하위 항목 수 등 표시; AI 메타·산출물 생성 없음). *(1.11.1의 "폴더 단일 클릭=진입"을 더블 클릭=진입으로 대체.)* (arch 10 §8·§8b·§7a·§4)
  - [ ] 1.13.3 **"AI 질문" → "RAG 질문" 명칭 변경** — 검증: AI 질문 = `/search/ask` = **RAG**(컨텍스트 조립 + 인용 강제 생성, arch 08 §9·§10·§12) 확인됨. 헤더 버튼·다이얼로그 타이틀 라벨을 "RAG 질문"으로. (arch 10 §11)
  - [ ] 1.13.4 **소요 시간(초) 표시 (AI 성능 측정용)** — 추후 AI 성능 테스트 활용. 표시 위치: ① **검색 다이얼로그** = 검색(retrieval) 소요 시간, ② **RAG 질문 다이얼로그** = RAG 전체 소요 시간, ③ **메타데이터 패널** = 문서 업로드·인제스트 소요 시간(AI 산출물 문서는 생성 소요 시간). 백엔드: `generations.latency_ms`/`started_at`/`finished_at`는 **이미 존재**(arch 03), `/search`·`/search/ask` 응답에 **`elapsed_ms` 추가**(arch 08 §12), documents에 **인제스트 소요 필드 추가**(arch 03/07). 프로토타입은 목업 초 단위 표시. (arch 10 §11·§7a, 08 §12, 09, 03, 07 §9)
  - [ ] 1.13.5 **AI 산출물 = 1급 문서 ("산출물 내역")** — 우측 패널 **"생성 이력" → "산출물 내역"** 명칭 변경. AI 산출물(요약/초안/보고서)은 **문서로 저장(materialize)**되어 Center 목록 노출·검색·RAG 대상(08은 documents/chunks 기준이라 자동 포함). **산출물 내역 row 클릭 → Center가 해당 산출물 문서가 위치한 폴더로 이동(+선택)**. Center에서 산출물 문서 **삭제 시 원본의 산출물 내역에서 사라짐**(내역 = 출력 문서가 존재하는 생성만). arch 09: 생성 성공 시 **출력 문서 materialize**(documents 행 + MinIO 오브젝트) + 계보에 출력 문서 링크. arch 03: `generations.output_document_id`(또는 documents `origin`/`source_generation_id`) 추가. 산출물 문서의 폴더 위치 정책(기본=원본과 동일 폴더)은 추후 확정. (arch 09, 03 §5, 10 §8·§11)
  - [ ] 1.13.6 **우클릭 컨텍스트 메뉴** — 좌측 트리 폴더, Center 폴더/파일 row에서 **마우스 우클릭** 시 해당 항목의 "⋯" 드롭다운과 **동일한 메뉴**를 컨텍스트 메뉴로 표시(폴더=이동/이름변경/삭제, 파일=상세 보기/다운로드/삭제). shadcn **`context-menu`** 사용. 기존 "⋯" 버튼과 액션 핸들러 공유. (arch 10 §8a)

> **🚦 게이트(Phase 2 진입 전):** 1.9 프로토타입 + **1.10·1.11·1.12·1.13 개정** 반영본으로 **UI 동선 사용자 재검수** 필수. 승인 전 Phase 2 착수 금지.
