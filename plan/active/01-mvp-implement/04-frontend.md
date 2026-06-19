---
created: 2026-06-11
completed: —
overview: Phase 1 프로토타입 승계 → 목업 제거·실 API 배선(Left 트리 / Center 목록·검색결과 / Right 토글 인스펙터, frontend).
---

> UI 컴포넌트 탐색·추가는 shadcn MCP, 라이브러리·API 버전은 context7 MCP로 확인.

## 배선
- [x] A1 목업 제거(`lib/mock-data.ts` 삭제) + `lib/api`(client/dto/map/keys/hooks)로 실 API 전환, `NEXT_PUBLIC_API_URL`(`lib/config.ts`·`.env.local`) 주입 (§1).
- [x] A2 AppShell + 서버 프리패치(폴더/문서 첫 페이지) `HydrationBoundary` 시드(`(archive)/layout`·page) + Toaster(sonner) (§2·§3).
- [x] A3 `QueryProvider`(react-query) + Zustand 스토어를 UI 상태 전용으로 축소(서버 데이터·목업 mutation 제거) (§3·§4).
- [x] A4 라우팅 — route group `(archive)` 공유 layout 유지·page별 분리, 가상 루트(`folder_id`/`parent_id` NULL=내 아카이브) + `?doc={id}` 딥링크 + `lib/routes.ts` 헬퍼 (§8).

## 3패널
- [x] B1 Left — FolderTree(`useFolders` + create/rename/move/delete 낙관·롤백) + "⋯"/컨텍스트 + 다이얼로그 + AppHeader 토글 (§5, folders-frontend).
- [x] B2 Center — DocumentList(TanStack Table + `useInfiniteQuery` keyset cursor·더 보기) + 하위 폴더 row + "⋯"/컨텍스트 + 단일=선택·더블=진입 + presigned 다운로드 + UploadDropzone(3단계, 미노출) (§6, document-frontend).
- [x] B3 인제스트 `status`/`stage` react-query 폴링(목록·상세, ready/failed 정지) (document-frontend §3).
- [x] B4 Right — DetailInspector(문서=상세+원본보기(presigned GET 텍스트)+메타+계보+산출물 내역 / 폴더=FolderDetail) (§4·§5·§6).

## 검색·산출물·반응형·테마
- [x] C1 통합 검색 — SearchBar + 모드 드롭다운(키워드/의미=`POST /search`, rag=`POST /search/ask`), 결과는 Center(리스트/답변)·뒤로가기·`elapsed_ms`/개수 + 청크 subrow + 인용 문서명 단건 조회 보강 (§6, search-frontend).
- [x] C2 AI 산출물 — 생성 트리거(`POST /generations` + 진행 폴링) + 산출물 내역 + 계보(`output_document_id` 역조회 → `/lineage`) + Report 차트 react-vega(dynamic ssr:false) 렌더 (§6, ai-outputs-frontend §1·§2·§3·§4).
- [x] C3 반응형 — PC 3패널 / 모바일 Sheet(Left=left, Right=전체화면 right) + 다이얼로그 풀스크린 (프로토타입 승계, §7).
- [x] C4 라이트/다크 — next-themes + 듀얼 토큰, FOUC 방지 (프로토타입 승계, §1).
- [x] C5 MinIO 버킷 CORS — `scripts/minio-cors.sh`(mc `cors set`, web 오리진 GET/PUT/HEAD), 라이브 MinIO에 1회 적용 필요 (§9, infrastructure §4).

## 헤더 액션 메뉴 (후속)
- [x] D1 헤더 테마 버튼 → "⋯" 드롭다운(파일 추가·폴더 추가·테마), PC·모바일 동일 (§1·§5).
- [x] D2 파일 추가 — 숨은 `<input>` ref 클릭 + 공용 업로드 훅(`UploadDropzone` 공유, 보존), 대상=현재 폴더.
- [x] D3 폴더 추가 — `useCreateFolder`+`FolderNameDialog` 재사용, 부모=현재 폴더.
- [x] D4 업로드 진행률 — `useUpload` XHR(`upload.onprogress`). fetch는 `http` MinIO(HTTP/1.1)에서 진행률 불가(h2c 미지원).
- [x] D5 아키텍처 — `frontend.md` §10 헤더 액션 메뉴 절 추가.
- [x] D6 빈 목록 우클릭 컨텍스트 메뉴(폴더 추가·파일 추가), 헤더와 동일 로직.
- [x] D7 진행률 위치 이전 토스트→인스펙터 — Zustand `uploadProgress`, `useUpload.onInit(docId)`, 단일 파일 업로드 시 자동 선택.
- [x] D8 표기명 진행형 정정(추출 중·메타 생성 중·청킹 중·임베딩 중) + `uploaded`="업로드 대기" (`lib/format.ts`).

## 인제스트/업로드 진행 표시 (후속)
- 백엔드는 단계 내부 %를 노출 안 함(stage 이산, documents-schema·ingestion §2·§4) → status+stage를 단계 순서 %로 프론트에서 파생.
- [x] D9 `lib/ingest.ts` `ingestProgress(status, stage, uploadPct?)` — 업로드 대기 0·추출 20·메타 40·청킹 60·임베딩 80·완료 100, 업로드 중은 0–20% 구간, ready/failed 바 없음.
- [x] D10 DocumentDetail 상태 태그 밑 `Progress` 바+캡션(uploaded·processing만, ready 숨김·failed 에러블록). D7의 메타데이터 탭 블록 제거·통합.
- [x] D11 아키텍처 — `frontend.md` §11 인제스트/업로드 진행 표시 절 추가(§10 진행률 위치 갱신).
- [x] D12 진행 바 우측 "취소" 버튼 → confirm → `useDeleteDocument` 삭제(진행률 clear·인스펙터 닫기·toast).
- [x] D13 백엔드 선제 abort — `allow_abort_jobs=True`, `queue.abort_job()`, `delete`가 row 삭제 전 `abort_job(ingest:{id})`. 진행/대기 job 취소(`CancelledError`→failed 미기록), 모든 삭제 경로 공통.
- [x] D14 취소 시 클라 업로드 XHR 중단(고아 방지) — `lib/upload-control.ts` 레지스트리, `useDeleteDocument`가 DELETE 전 `abortUpload(id)`. 늦은 PUT 차단·`/complete` 404 회피, `AbortError` 토스트 생략.
- [ ] D15 (백엔드 후속 TODO) 협조적 취소로 OCR 단계 조기 중단 — `to_thread` OCR가 길면 abort가 스레드 종료까지 지연(데이터 안전, 낭비만). 단계 사이 문서 존재 확인으로 조기 반환. 우선순위 낮음.
