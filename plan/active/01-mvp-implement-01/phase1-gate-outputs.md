---
status: transient
scope: phase-1-gate
absorbed_by: ["1.8 (globals.css/theme)", "1.9 (UI 프로토타입 코드)", "1.10 (개정1; §1.10.8 메타보정은 MVP 제외→research/01 §8)", "1.11 (개정2; Google Drive식 목록·하위폴더 row·패널 헤더 토글·TanStack Table 서버페이지네이션·업로드영역 미노출·검색/질문 역할분리·RAG textarea)", "1.12 (개정3; 우측=모바일 전체화면 Sheet·row 클릭 토글·패널 헤더 닫기버튼 제거·검색 하이브리드 고정/뱃지 제거)", "1.13 (개정4; Center 폴더 ⋯ 액션·폴더 단일=인스펙터/더블=진입·AI질문→RAG질문·소요시간 표시·AI산출물=1급 문서/산출물 내역)"]
arch_sot: architecture/10-frontend-drive-ui.md
---

# Phase 1 게이트 산출물 (1.2 · 1.5 · 1.6)

> **성격:** 이 문서는 **영구 설계 문서가 아니다.** `architecture/`가 SoT이며, 본 노트는
> 1.1~1.6 검증 게이트 중 **코드로 흘러갈 산출물**(와이어프레임·토큰·UX 플로우)을 1.8/1.9가
> 흡수하기 전까지 담아두는 **임시 실행 스캐폴드**다. 1.9 프로토타입 구현 시 본 내용은
> `web/` 코드(`globals.css`/theme, 컴포넌트)로 이관되고 이 파일은 폐기 대상이다.
>
> 검증 델타(1.1·1.3)와 API 갭(1.4)은 이미 arch에 역반영 완료:
> arch 10 §4(컴포넌트 맵+테마/반응형/검색·생성), 10 §7(상태 소유 경계), 06 §5.1(문서 API 계약), 07 §9(PATCH 링크).

---

## 1.2 와이어프레임 (저충실도 ASCII)
arch 10 §12 반응형 3단 기준. 고충실도는 1.9 프로토타입 자체.

> ⚠️ **아래 스케치는 1.10~1.12 개정 이전본** — 실제 레이아웃은 **1.10~1.12/arch 10 기준**:
> **(1.10)** ① 하단 DocumentDetail 패널 제거(상세는 Right로), ② **Right=토글 인스펙터**(row 선택/"⋯" 시), ③ MetadataEditor는 **읽기 전용 뷰**(보정 제외), ④ DocumentDetail에 **"원본 보기"** 버튼(미리보기 없음), ⑤ 폴더 행 **"⋯" 드롭다운** + New/Rename/Move 다이얼로그, ⑥ 목록은 **등록일**만.
> **(1.11)** ⑦ 목록은 **Google Drive식**(하위 폴더 row + 문서 row 혼합, 폴더 클릭=진입), ⑧ **업로드 드롭존 미노출**(컴포넌트는 보존), ⑨ Center 좌우 패딩·상단 border 제거, ⑩ **Left/Right 패널 헤더 토글 버튼**(PC·모바일), ⑪ 모바일 풀스크린 다이얼로그 콘텐츠 **상단 정렬**, ⑫ 목록 테이블 = shadcn `Table` + **TanStack Table 헤드리스(서버 페이지네이션)**, ⑬ **검색=결과 리스트 / AI 질문=RAG 답변** 역할 분리(검색 "RAG" 모드 제거), ⑭ AI 질문 입력 = **auto-grow textarea**.
> **(1.12)** ⑮ 우측 인스펙터 모바일 = **전체 화면 `Sheet`(side=right)**(바텀 시트 아님), ⑯ 우측은 **문서 row 클릭 토글**(같은 row 재클릭=닫힘), ⑰ **좌/우 패널 헤더 닫기 버튼 제거**(좌=AppHeader 토글, 우=row 토글로 일원화), ⑱ **검색=하이브리드 고정**(모드 뱃지 제거; `/search` 기본 hybrid, `mode?`는 평가/override용 API에만).
> **(1.13)** ⑲ Center 폴더 row **"⋯" 액션**(이동/이름변경/삭제, 공용 FolderActions), ⑳ Center 폴더 row **단일 클릭=폴더 인스펙터 토글·더블 클릭=진입**, ㉑ **"AI 질문"→"RAG 질문"** 개명, ㉒ **소요 시간(초)** 표시(검색=`elapsed_ms`/RAG=`elapsed_ms`/문서=`ingest_ms`/산출물=`latency_ms`), ㉓ **AI 산출물=1급 문서**("생성 이력"→"산출물 내역"; 산출물은 문서로 저장·검색·RAG; 내역 row 클릭→산출물 폴더로 이동; 삭제 시 내역 비노출), ㉔ **우클릭 컨텍스트 메뉴**(좌측 트리 폴더·Center 폴더/파일 = "⋯"와 동일 메뉴). (ASCII는 역사적 참고용)

### PC·태블릿 (`≥md`, 768+) — 3패널 + ResizablePanels
태블릿은 동일 3패널, 패널 폭만 축소.
```
┌──────────────────────────────────────────────────────────────────────┐
│ AppHeader   [🔎 검색 ............]  [Ask ▸]              [☾/☀ 테마 ▾] │
├──────────────┬───────────────────────────────────┬───────────────────┤
│ LeftPanel    │ CenterPanel                        │ RightPanel        │
│ FolderTree   │ ┌ UploadDropzone (drag&drop) ─────┐│ MetadataEditor    │
│              │ │  파일을 끌어다 놓기 / 클릭 선택  ││  제목 [.........] │
│ ▾ 📁 루트    │ └─────────────────────────────────┘│  요약 [.........] │
│   ▾ 📁 인사  │ DocumentList (table)               │  토픽 [tag][tag]+ │
│     📄 연봉.. │ ┌────────────────────────────────┐ │  키워드[tag][tag] │
│     📄 계약.. │ │ 이름        상태    수정일      │ │  [저장]           │
│   ▸ 📁 회계  │ │ 연봉계약.pdf ●ready 06-08      │ ├───────────────────┤
│   ▸ 📁 보고  │ │ 분기보고.pdf ◐processing 25%   │ │ GenerationTrigger │
│              │ │ 스캔본.pdf   ✕failed           │ │ [요약][초안][보고]│
│ [+ 새 폴더]  │ └────────────────────────────────┘ │ GenerationHistory │
│              │ DocumentDetail (선택 시 하단/탭)    │  • 요약 ✓ 06-09   │
│              │  메타·status/stage·미리보기·다운로드│  • 보고서 ◐ 진행  │
└──────────────┴───────────────────────────────────┴───────────────────┘
  └ ⟺ 리사이즈 핸들 ⟺            └ ⟺ 리사이즈 핸들 ⟺
```

### 모바일 (`<md`, <768) — 단일 패널 + Sheet/Drawer
```
┌─────────────────────────────┐      Left=Sheet(좌→우)      Right=Drawer(하→상)
│ [☰]  검색 ...........  [☾]  │     ┌──────────────┐        ┌──────────────────┐
├─────────────────────────────┤     │ FolderTree   │        │ MetadataEditor   │
│ CenterPanel (단일)          │     │ ▾ 📁 루트    │        │ 제목/요약/토픽   │
│ ┌ Upload ─────────────────┐ │     │   ▾ 📁 인사  │        │──────────────────│
│ │ 끌어다 놓기 / 선택       │ │     │     📄 연봉.. │        │ GenerationTrigger│
│ └─────────────────────────┘ │     │   ▸ 📁 회계  │        │ + History        │
│ 연봉계약.pdf  ●ready        │     │ [+ 새 폴더]  │        │                  │
│ 분기보고.pdf  ◐25%          │     └──────────────┘        └──────────────────┘
│ ...                         │      ☰(왼쪽 상단) 탭        ⋮/메타 버튼 탭
├─────────────────────────────┤
│ [📁 폴더] [＋업로드] [⋮ 메타]│ ← 하단 탭바(Sheet/Drawer 트리거)
└─────────────────────────────┘
```

**상태 표기 범례:** `●ready`(녹) · `◐processing/stage·%`(황) · `✕failed`(적) · `○uploaded`(회). 생성: `✓succeeded`·`◐running`·`✕failed`·`·queued`.

---

## 1.5 디자인 토큰 + shadcn 컴포넌트 후보 (MCP 탐색 결과)

### A. 토큰/테마 전략 (context7 `/shadcn-ui/ui` 확인)
- **Tailwind v4 방식:** `app/globals.css`에서 `:root`/`.dark`에 **oklch** CSS 변수 정의 + `@theme inline`으로 `--color-*` 노출. (별도 `tailwind.config` 색 정의 불필요.)
- **components.json(1.8 init 결과 기대값):** `style: new-york`, `baseColor: neutral`, `cssVariables: true`, `rsc: true`, `iconLibrary: lucide`.
- **테마 토글(next-themes):** `<ThemeProvider attribute="class" defaultTheme="system" enableSystem>`, `<html suppressHydrationWarning>` (FOUC 방지, arch 10 §3).
- **듀얼 토큰:** 모든 shadcn 표준 토큰을 라이트(`:root`)/다크(`.dark`) 쌍으로 정의.
- **🚦 구체 값은 1.8 이후 코드에 적용**(본 노트는 키 세트·구조만 확정; plan 산출물 정책).

**토큰 키 세트(라이트/다크 쌍으로 정의할 항목):**
```
표준(shadcn): --background --foreground --card(-foreground) --popover(-foreground)
              --primary(-foreground) --secondary(-foreground) --muted(-foreground)
              --accent(-foreground) --destructive(-foreground)
              --border --input --ring --radius --sidebar(-*) --chart-1..5
앱 확장(문서/생성 상태 배지용, @theme inline 추가):
              --status-ready --status-processing --status-failed --status-uploaded
              --gen-succeeded --gen-running --gen-failed --gen-queued
```
> `@theme inline { --color-status-ready: var(--status-ready); ... }` 형태로 노출 → `bg-status-ready` 등 유틸 사용.

### B. shadcn 컴포넌트 후보 (컴포넌트 맵 노드 → 레지스트리 아이템)
@shadcn 레지스트리 56개 `ui` 아이템 기준. **tree-view·dropzone는 @shadcn에 없음** → arch 10 §9의 외부 레지스트리(`shadcn-tree-view`, `shadcn-dropzone`) 사용.

| 컴포넌트 맵 노드 | shadcn 후보(@shadcn) | 비고 |
|---|---|---|
| ResizablePanels | `resizable` | react-resizable-panels 래퍼 |
| FolderTree | **외부** `shadcn-tree-view` + `collapsible`, `context-menu`(우클릭 CRUD), `button` | §9, 드래그 MOVE |
| DocumentList | `table`(shadcn) + **TanStack Table 헤드리스(`@tanstack/react-table`, `manualPagination`)** + `scroll-area`, `skeleton`, `badge`(상태), `dropdown-menu`(row "⋯") | **Google Drive식**(하위 폴더 row + 문서 row, 1.11.1), 서버 페이지네이션(1.11.7) |
| UploadDropzone | **외부** `shadcn-dropzone` + `progress` | presigned PUT 진행률. **MVP UI 미노출·컴포넌트 보존**(1.11.2) |
| DocumentDetail (Right) | `card`, `separator`, `badge`, `button`(원본 보기), `empty`(미선택) | 미리보기 없음; 텍스트=MD 뷰어 다이얼로그/기타=다운로드(1.10.1) |
| MetadataView (Right, 읽기 전용) | `card`, `separator`, `badge`, `label`(정적 표시) | 보정 MVP 제외(1.10.8) — input/form 없음. **업로드·인제스트 소요(`ingest_ms`) 표시**(1.13.4) |
| FolderDetail (Right, 읽기 전용) | `card`, `separator`, `label` | 폴더 단일클릭 시(1.13.2): 이름/등록일/하위 항목 수 |
| 폴더 다이얼로그 | `dialog`, `input`, `button`(New/Rename) · `dialog`+트리 선택(Move) | 1.10.5·1.10.7, 모바일 풀스크린(1.10.9) |
| 폴더 액션(FolderActions) | `dropdown-menu`(폴더행 "⋯") + `context-menu`(우클릭) | **Left 트리·Center 목록 공용**(1.10.6·1.13.1), 우클릭=동일 메뉴(1.13.6) |
| 우클릭 컨텍스트 메뉴 | `context-menu` | 폴더=이동/이름변경/삭제, 파일=상세/다운로드/삭제. "⋯"와 핸들러 공유(1.13.6) |
| GenerationTrigger | `dialog`, `select`, `tabs`, `button` | 요약/초안/보고서 옵션 |
| 산출물 내역(ArtifactList) | `table`/`item`, `badge`, `progress`, `scroll-area` | "생성 이력" 개명(1.13.5). 출력 문서 존재 건만, row 클릭→산출물 폴더 이동, 생성 소요(`latency_ms`) |
| SearchBar/Results | `input`/`input-group`, `command`(팔레트), `kbd`, `scroll-area` | **retrieval 전용 결과 리스트** · **모드 선택 UI 없음 → 항상 하이브리드 고정**(1.12.4; RAG 모드도 제거 1.11.8) |
| RAG 질문(AskDialog) | `dialog`, `textarea`(**auto-grow** 1.11.9), `scroll-area`, `skeleton` | **RAG 답변+인용 전용**(`/search/ask`). 라벨 "RAG 질문"(1.13.3), RAG 소요(`elapsed_ms`) 표시(1.13.4) |
| ThemeToggle | `dropdown-menu`, `button` + lucide(Sun/Moon) | light/dark/system |
| 패널 토글 | AppHeader `button` + lucide(PanelLeft) | Left=AppHeader 토글 / Right=문서 row 클릭 토글. **패널 헤더 닫기 버튼 없음**(1.12.3) |
| 모바일 Left/Right | `sheet`(좌 트리, side=left), `sheet`(우 인스펙터, **side=right 전체 화면**) | 바텀 시트 아님(1.12.1) · arch 10 §12 |
| 삭제 확인 | `alert-dialog` | 폴더/문서 재귀 삭제 경고 |
| 전역 알림 | `sonner`(Toaster) | 업로드/인제스트/생성 완료·실패 |
| 로딩/빈 상태 | `skeleton`, `spinner`, `empty` | 패널별 스트리밍 |

**📌 컴포넌트 선정 델타(1.5 발견):** Report 차트는 shadcn `chart`(recharts)를 **쓰지 않는다.** arch 09 §3·§6이 **Vega-Lite 선언형 + react-vega**를 채택(LLM이 스펙 생성, 코드 실행 X). shadcn `chart`는 후보에서 제외.

---

## 1.6 presigned 3단계 업/다운로드 UX 플로우 (arch 06 §4·§5 정합)

### 업로드 (3단계, 브라우저↔원격 MinIO 직접)
```
사용자 파일 선택/드롭
   │
   ▼ ① Init    POST /documents {folder_id,filename,size,mime}
   │           ← { document_id, upload_url(presigned PUT, 짧은 TTL 5~15분) }   status=uploaded
   │           UX: 목록에 낙관적 행 추가(○uploaded, 0%)
   ▼ ② Upload  PUT upload_url  (브라우저 → MinIO 직접, body=파일)
   │           UX: XHR/fetch 진행률 → progress 바(%). 취소 가능. 실패 시 재시도/행 제거
   ▼ ③ Confirm POST /documents/{id}/complete
   │           ← stat_object 검증 OK → status=processing + 인제스트 enqueue
   │           UX: 행 상태 ○→◐processing, Toaster "업로드 완료, 처리 시작"
   ▼ ④ 폴링    GET /documents/{id}  (react-query refetchInterval)
               stage: extracting→generating_meta→chunking→embedding
               UX: 배지 ◐stage·%.  status∈{ready,failed} 도달 시 폴링 정지(07 §12)
               ready → ●ready + 메타 자동 채움 / failed → ✕failed + error 툴팁
```
**엣지/규칙**
- TTL 만료(②까지 지연) → upload_url 무효 → 재-Init. 고아 오브젝트는 백엔드 정리 잡(06 §8).
- Confirm 멱등: 이미 processing/ready면 무시(06 §8) → 중복 클릭 안전.
- 업로드 변조 방지: presigned PUT 서명에 `Content-Length`/`Content-Type` 조건(06 §10.2) → 클라이언트는 Init 신고값과 동일 헤더로 PUT.
- 동시 업로드: 파일별 독립 상태 행(병렬 진행률).

### 다운로드 (presigned GET, 단발)
```
[다운로드] 클릭
   ▼ GET /documents/{id}/download   ← (발급 전 owner_id 검사, 06 §10) presigned GET URL
   ▼ 브라우저가 URL로 직접 fetch/네비게이트
     Content-Disposition: 한글 원본명 RFC 5987(filename*) → 파일명 보존
```
**규칙**
- 발급 전 `owner_id` 검사 필수(발급 후 URL은 앱 인증 우회, 06 §10). 권한 외 404.
- TTL 짧게(5~15분). URL 로깅/히스토리 노출 주의 — UX상 새 탭 직접 네비게이트 대신 즉시 fetch→blob 저장 권장.
- http(비TLS) 평문 전송 = 현 구성 최대 위험(06 §10.1) → 운영 전 TLS 필수(별도 인프라 과제).

### 검색/Ask UX 연계(참고, 1.9 동선)
검색 결과·`/search/ask` 인용 `[n]` 클릭 → 해당 `document_id` 선택 + `chunk_id` 위치로 DocumentDetail 딥링크(arch 08 §9·§12, 10 §11).

---

## 1.10.8 메타데이터 사용자 보정 — **MVP 제외 (보고는 research로 이관)**
검수 질문(메타 input 의도/저장/표시)에 대한 타 서비스 사례 분석은 **`research/01-document-processing.md §8`로 이관**했다. **MVP는 보정 기능을 넣지 않고 AI 생성 메타를 그대로(읽기 전용) 표시**한다. 오입력 보정 방식(수동 입력 vs AI 프롬프트)은 추후 결정 → arch 변경(03 §5 `user_*`, 10 §7a) 철회.
