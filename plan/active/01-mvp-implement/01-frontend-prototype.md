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

## 프로토타입
- [x] C1 3패널 셸 + 핵심 동선 목업 + 라이트/다크 + 3단 반응형.
- [x] C2 `web/README.md` — dev 구동 명령 + 가동 전 `npm run lint`.
- [x] C3 Tailscale dev 접속 — `next.config.ts` `allowedDevOrigins` tailnet 한정·공개 금지 (document-backend §7).

## 개정 반영 (C1 게이트 피드백, D~G)
- [x] D 인스펙터 우측 통합·토글화, Center 목록 전용, 등록일만, `Mechive` 타이틀, 폴더 CRUD/이동 다이얼로그, 메타 읽기 전용, 모바일 풀스크린 (§1·§5a·§6·§6a·§6b·§8·§10, folders §5).
- [x] E Google Drive식 — 목록 내 하위 폴더 row, 업로드 UI 제거(컴포넌트 보존), 패널 헤더 토글, shadcn Table+TanStack 서버 페이지네이션, textarea 자동 개행 (§2·§6·§7·§8·§10).
- [x] F 우측 패널 모바일 전체화면 Sheet + row 클릭 토글·개폐 일원화 (§6b·§10).
- [x] G Center 폴더 "⋯" 공용 `FolderActions`, 단일=인스펙터·더블=진입, 소요 시간(`elapsed_ms`) 표시, AI 산출물 1급 문서·계보 패널, 우클릭 컨텍스트 메뉴 (§5a·§6·§6a·§6b·§9, ai-outputs §6, ai-outputs-backend §1).

## 검색 동선 목업 (통합 검색, search-frontend)
- [x] H1 SearchBar 진입 — AppHeader textarea + "검색..." 모드 드롭다운(키워드/의미/rag), Enter=드롭다운 트리거·Shift+Enter=줄바꿈, stepped auto-grow (search-frontend §1·§2).
- [x] H2 키워드/의미 결과 화면 — Center 조회→결과 화면 전환, 로딩 후 결과 리스트, 공통 메타(`elapsed_ms`·총 결과 수), 각 row 아래 청크 정보 toggle (search-frontend §3·§3a).
- [x] H3 rag 결과 화면 — Center 로딩 후 합성 답변 + 인용, 공통 메타(`elapsed_ms`·총 인용 수) (search-frontend §3·§3a).
- [x] H4 뒤로가기 동선 — 화면 제목 옆 버튼으로 결과 화면→조회 화면 복귀, 표시 여부 Zustand (search-frontend §4·§5).

## 화면 전환 동선 목업 (추가)
- [x] I1 계보 부모 문서 링크 클릭 → Center가 부모 문서로 이동·선택 (ai-outputs-frontend §3).
- [x] I2 원본 보기 분기 — 텍스트류=`OriginalViewerDialog` 인앱 열람 / 그 외=presigned GET 다운로드 (document-frontend §2).

## 상태 흐름 동선 목업 (인제스트·생성, backend 연계)
- [x] J1 인제스트 상태 폴링 — DocumentDetail에 `status`/`stage`(extracting→generating_meta→chunking→embedding) 진행 → ready=메타·소요(`ingest_ms`) / failed=`error` 표시·폴링 정지 (document-frontend §3, ingestion-backend §1, document-backend §1).
- [x] J2 생성 비동기 상태 — GenerationTrigger(Dialog) → `queued`/`running` 진행 폴링 → `succeeded`=산출물이 Center 목록·"산출물 내역"·계보에 등장 / `failed` (ai-outputs-frontend §1, ai-outputs-backend §2).
- [x] J3 완료·실패 알림 — 업로드/인제스트/생성 완료·실패 Toaster(sonner) (frontend §2).

## 개정 반영 (검수 피드백, K)
- [x] K1 우측 인스펙터 스크롤 — "문서 상세" 헤더 아래 전체(상세·원본/다운로드 버튼·메타 탭)를 단일 스크롤 영역으로. 현재 상세(크기~처리 시간)·버튼이 고정이라 모바일에서 불편 (frontend §6·§6b·§10, document-frontend §3).
- [x] K2 모바일 Sheet 닫기 버튼(X) 제거 — 좌측 폴더 Sheet·우측 인스펙터 Sheet 모두. 개폐는 row 재클릭/스와이프로 일원화("패널 닫기 버튼 없음" 규칙) (frontend §6b·§10).
- [x] K3 키워드/의미 결과를 문서 목록 table 디자인으로 통일 — 카드 폐기, 일반 목록 row 형식 + 청크 정보는 해당 row 밑 subrow(확장)로 표시 (search-frontend §3·§3a, document-frontend §1).
- [x] K4 헤더 고정 높이 유지 — SearchBar textarea가 늘어나도 header 높이는 불변. textarea는 고정 높이 내 스크롤 또는 아래로 오버레이 확장해 헤더/레이아웃을 밀지 않음 (search-frontend §2, frontend §2).
- [x] K5 Toaster(sonner) 표시 정리 — position `top-center`, `richColors` 미사용(배경색 제거), 성공/실패는 타입 아이콘으로만 구분 (frontend §2).
- [x] K6 산출물 생성 다이얼로그 모바일 풀스크린 — 현재 모바일에서 사이드바처럼 보임. GenerationTrigger Dialog를 모바일(`<md`)에서 화면 꽉 채우는 풀스크린으로 (frontend §10, ai-outputs-frontend §1).
- [x] K7 검색 결과 subrow 가시성 — 키워드/의미 청크 subrow를 본 row와 구분(들여쓰기·구분선·약한 배경 등). success/fail처럼 과도하게 강조되는 색조는 사용 금지 (search-frontend §3a).
- [x] K8 검색 결과 row "⋯" 메뉴 — 키워드/의미/rag 결과의 원본 문서 row에 드롭다운: 상세 보기/다운로드/삭제/해당 폴더로 이동 (search-frontend §3, document-frontend §1, ai-outputs-frontend §2).
- [ ] K11 우측 인스펙터 자동 닫힘 — 선택 row가 있을 때만 펼침. Center 컨텐츠가 새로 렌더되면(재검색·폴더 이동 등) 선택 해제·인스펙터 닫힘 (frontend §6b).
- [ ] K12 모바일 SearchBar 포커스 확장 — 모바일에서 textarea 포커스 시 textarea+검색 버튼만 노출(브랜드·패널 토글 가림)해 입력 폭 확보, blur 시 원복 (search-frontend §2, frontend §2·§10).
- [ ] K13 청크 subrow 카드화 — subrow를 여백 적은 카드로 감싸고, 일치하는 청크를 잘림/가림 없이 전부 표시(snippet 한 줄 clamp 제거) (search-frontend §3a).
- [ ] K14 헤더 SearchBar 중앙 정렬 — `≥md` 헤더에서 SearchBar+검색 버튼을 가운데 배치 (frontend §2).

> 🚦 검색은 단일 진입(키워드/의미/rag, 결과는 Center) 모델로 개정 — 구 하이브리드 목업(`ask-dialog`·`search-dialog`) 폐기·삭제. 통합 모델 목업 구현 완료(H1~H4), 정본은 search-frontend.md, Phase 2 구현은 04-frontend C1.
> 🚦 Phase 2 진입 전: C1 + 개정 반영본(D~G) + 통합 검색·추가·상태 동선(H·I·J) + 검수 피드백(K)으로 UI 동선 사용자 재검수 필수.
