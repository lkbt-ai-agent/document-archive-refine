---
created: 2026-06-11
completed: —
overview: 백엔드 착수 전 UI/데이터 흐름 확정 + 클릭 가능한 목업 프로토타입으로 동선 검수(라이트/다크·3단 반응형 전제, frontend-drive-ui).
---

## 설계 검증
- [x] A1 컴포넌트 맵 검증 — 누락/변경만 arch 역반영 (frontend-drive-ui §4).
- [x] A2 와이어프레임 — 저충실도 ASCII 레이아웃, 고충실도는 C1 (§12).
- [x] A3 상태 소유 검증 — react-query(서버) vs Zustand(UI) 경계 (§6·§7).
- [x] A4 API 계약 점검 — 도메인 문서(folders~ai-outputs) 엔드포인트 갭을 arch에 역반영.
- [x] A5 디자인 토큰 — 라이트/다크 듀얼 토큰 + shadcn 후보, 값은 B2 이후 코드 (§9·§3).
- [x] A6 presigned 3단계 업/다운로드 UX 플로우 정의 (document §3).

## 스캐폴드
- [x] B1 Next.js 스캐폴드 (`create-next-app`, 프로젝트명 `web`).
- [x] B2 shadcn/ui 초기화 (`shadcn init --preset b6F9PilA8`).

## 프로토타입
- [x] C1 3패널 셸 + 핵심 동선 목업 + 라이트/다크 + 3단 반응형.
- [x] C2 `web/README.md` — dev 구동 명령만, 가동 전 `npm run lint` 선행 명시.
- [x] C3 Tailscale dev 접속 — `next.config.ts` `allowedDevOrigins`에 Mac mini 호스트 등록, tailnet 한정·공개 금지 (document §6).

## 개정 1차 (C1 게이트 피드백)
- [x] D1 하단 상세 패널 제거 → 우측 통합, Center는 목록 전용, "원본 보기" 버튼만 (§4·§8·§10).
- [x] D2 우측 패널 토글화 — row 선택/"⋯" 클릭 시 열림 (§8b).
- [x] D3 등록일만 표시(수정일 비노출) (§10).
- [x] D4 앱 타이틀 `Mechive`(표시명만) (§1).
- [x] D5 새 폴더 다이얼로그 → `POST /folders` (§8a).
- [x] D6 좌측 폴더 "⋯" 드롭다운(이동/이름변경/삭제) (§8a).
- [x] D7 폴더 이동 다이얼로그 — 트리에서 상위 선택, 사이클 방지 (§8a, folders §5).
- [x] D8 메타데이터 읽기 전용 표시(보정 MVP 제외) (§7a).
- [x] D9 모든 다이얼로그 모바일 풀스크린 (§12).

## 개정 2차 (Google Drive식)
- [x] E1 목록에 하위 폴더 row 렌더(폴더 먼저, 클릭=진입) (§4·§8·§10).
- [x] E2 업로드 영역 UI 제거(컴포넌트는 보존) (§4·§10).
- [x] E3 Center 좌우 패딩(스타일).
- [x] E4 Center 상단 border 제거(스타일).
- [x] E5 좌/우 패널 헤더 토글 버튼 (§8·§12).
- [x] E6 모바일 풀스크린 다이얼로그 상단 정렬 수정 (§12).
- [x] E7 목록 테이블 = shadcn Table + TanStack 헤드리스, 서버 페이지네이션(context7 확인) (§4·§9·§10).
- [x] E8 검색=retrieval / RAG=생성 역할 분리, 검색 "RAG" 배지 제거 (§11, search-and-rag §11).
- [x] E9 RAG 프롬프트 입력 = 자동 개행 textarea(1줄→최대 n줄 후 스크롤) (§11).

## 개정 3차
- [x] F1 우측 패널 모바일 = 전체 화면 Sheet(side=right) (§8b·§12).
- [x] F2 우측 패널 row 클릭 토글(재클릭=닫힘) (§8b).
- [x] F3 좌/우 패널 헤더 닫기 버튼 삭제, 개폐 일원화 (§8·§8b).
- [x] F4 검색=하이브리드 고정·모드 뱃지 제거(`mode?`는 백엔드 유지·UI 미노출) (§11, search-and-rag §11).

## 개정 4차
- [x] G1 Center 폴더 row "⋯" 드롭다운, 공용 `FolderActions` 추출 (§8a·§4·§10).
- [x] G2 폴더 row 단일=인스펙터 토글·더블=진입, 인스펙터 문서/폴더 확장 (§8·§8b·§7a).
- [x] G3 "AI 질문" → "RAG 질문" 명칭 변경 (§11).
- [x] G4 소요 시간 표시 — 검색/RAG/메타데이터/생성, 응답에 `elapsed_ms` (§11·§7a, search-and-rag §11).
- [x] G5 AI 산출물=1급 문서("산출물 내역"), materialize + row 클릭 이동, 삭제 시 비노출 (ai-outputs, generations-schema.md, §11).
- [x] G6 우클릭 컨텍스트 메뉴 = "⋯" 동일 액션(shadcn context-menu) (§8a).
- [x] G7 AI 산출물 계보 패널 — 부모 링크·모델/seed·프롬프트, `/generations/{id}/lineage` (§7a, ai-outputs §6·§10).

> 🚦 Phase 2 진입 전: C1 + 개정 D~G 반영본으로 UI 동선 사용자 재검수 필수.
