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

> 🚦 검색/RAG는 이후 단일 진입(키워드/의미/rag, 결과는 Center) 모델로 개정됨 — 정본은 search-frontend.md, Phase 2 구현은 04-frontend C1.
> 🚦 Phase 2 진입 전: C1 + 개정 반영본으로 UI 동선 사용자 재검수 필수.
