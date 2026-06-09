# 10. 프론트엔드 (3-Panel Drive UI) — 작성 플랜

> **산출물:** `architecture/10-frontend-drive-ui.md`
> **상태:** ⬜ Not started
> **근거 research:** `research/04 §5`
> **선행:** 05~09 (백엔드 API 계약 확정 후)

## 목적
Next.js 16/React 19 기반 3패널 Drive UI의 서버/클라이언트 분리, 데이터·상태 관리, 컴포넌트, 반응형 설계를 정의한다.

## 지켜야 할 제약
- 파일 업/다운로드는 원격 MinIO presigned URL 직접 호출(06과 정합).
- 백엔드 API는 `NEXT_PUBLIC_API_URL`로 주입(원격/로컬 무관).

## 작성 단계 (= 아키텍처 문서 섹션)
- [ ] S1. **개요/범위** — 3패널 Drive UI, requirement 레이아웃 매핑.
- [ ] S2. **전체 레이아웃 컴포넌트 맵(우선 구상)** — 세부 설계 진입 전에 **전체 레이아웃의 컴포넌트 맵을 먼저 그린다**. 페이지 → 3패널 → 하위 컴포넌트 → 원자 단위까지의 트리와 각 컴포넌트의 책임·상태 소유(서버/클라이언트 구분 포함)를 명시.
- [ ] S3. **서버/클라이언트 분리** — RSC 셸·초기 패치(Suspense 스트리밍) vs `"use client"` 고상호작용(트리/드롭존/메타 편집).
- [ ] S4. **데이터 레이어** — react-query(목록/상세/트리 + 파이프라인 폴링 + 캐시·낙관 업데이트), RSC 초기 렌더 `HydrationBoundary` 시드. Server Actions는 선택(FastAPI와 로직 중복 금지).
- [ ] S5. **UI 상태** — 선택/확장은 Zustand(또는 context), 트리는 평면 리스트→`useMemo` 구성, 낙관 업데이트·롤백.
- [ ] S6. **3패널 구성** — Left(폴더 트리 CRUD/MOVE), Center(문서 목록/상세/업로드/다운로드/삭제/이동), Right(메타데이터 + AI 생성 이력 요약).
- [ ] S7. **컴포넌트 선정·커스터마이징 전략** — 컴포넌트 구현 시 **shadcn/ui MCP로 적합한 컴포넌트를 탐색·선정**하고, 자세한 커스터마이징은 **Tailwind CSS**로 진행한다. 기본 빌딩블록: Resizable(react-resizable-panels), tree-view(shadcn-tree-view), dropzone(shadcn-dropzone)→presigned PUT, Lucide 아이콘.
- [ ] S8. **업로드/다운로드 UX** — presigned 3단계 연동(06), 진행률, 파이프라인 status/stage 폴링 표시(ready/failed 정지).
- [ ] S9. **검색·AI 산출물 UI** — 검색 입력(키워드/자연어), 결과·인용 클릭→원문 딥링크, 요약/초안/보고서 생성·이력 패널(08/09 연동).
- [ ] S10. **반응형** — 데스크톱 3패널 → 모바일 단일 패널 + Sheet/Drawer.

## 캡처할 핵심 결정 (research)
- react-query 1차 데이터 레이어 + Zustand UI 상태, RSC 셸 + Client 패널.

## 다이어그램
- [ ] 3패널 레이아웃 와이어프레임.
- [ ] 컴포넌트 트리 + 데이터 흐름(react-query ↔ FastAPI ↔ presigned MinIO).

## 제약·리스크·오픈 이슈
- [ ] **CORS** — 브라우저→원격 MinIO presigned 호출 시 버킷 CORS 설정 필요(06과 정합).
- [ ] **API 계약 의존** — 05~09 스키마 확정 후 작성.
- [ ] **폴링 부하** — 인제스트/생성 폴링 주기 조정.

## 완료 기준
- [ ] `architecture/10-*.md` 존재, S1~S10 충족.
- [ ] presigned 직접 업/다운로드(원격 MinIO)·CORS가 반영됨.
- [ ] 모든 패널이 백엔드 API 계약과 연결됨.
