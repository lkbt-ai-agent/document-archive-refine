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

## 목록 컨텍스트 메뉴 보강 (후속)
- 증상: 폴더·파일이 있는(비어있지 않은) DocumentList에서 배경 우클릭/모바일 롱프레스 시 메뉴가 안 뜸. D6은 빈 상태(`isEmpty`)에만 ContextMenu를 감싸, 행이 있는 목록의 배경엔 추가 메뉴가 없음.
- [x] D16 목록 배경 컨텍스트 메뉴 — 비어있지 않은 목록에서도 배경(행 외 영역) 우클릭/롱프레스 시 [폴더 추가]·[파일 추가] 노출. 방안: 목록 컨테이너(테이블 래퍼/ScrollArea 내용)를 `ContextMenu`로 감싸 `useArchiveActions` 재사용, 행별 컨텍스트 메뉴(폴더 액션·문서 다운로드/삭제)는 그대로 유지(이벤트 전파 분리). 빈 상태(D6)와 동일 동작으로 통합. 모바일 롱프레스가 `ContextMenu`를 트리거하는지 확인(미동작 시 터치 핸들러 보강).

## 원본 미리보기 (후속)
- 현재(document-frontend §2): 마크다운/텍스트만 인앱 뷰어, PDF·이미지는 presigned GET `attachment` 다운로드(인앱 렌더 안 함). MinIO는 바이트만 서빙 → 미리보기는 브라우저가 inline+Content-Type으로 렌더.
- [x] D17 PDF·이미지 인앱 미리보기 — "원본 보기"를 마크다운=뷰어(기존)·PDF/이미지=인라인 렌더로 확장. 백엔드: presigned GET에 inline 옵션(`response-content-disposition: inline` + `response-content-type=<mime>`) 추가(예: `GET /documents/{id}/download?disposition=inline` 또는 별도 `/preview`). 프론트: `onViewOriginal` 분기 확장 → `OriginalViewerDialog`에 PDF=`<iframe>`·이미지=`<img>` 임베드(또는 새 탭), 그 외 바이너리는 다운로드 유지. CORS(GET)는 기존 허용, Content-Type은 저장된 `mime_type` 사용. 아키텍처 document-frontend §2·document-backend §3 반영.
- [ ] D18 (미리보기 후속, 데스크톱 확인 후 결정) 모바일 PDF iframe 미렌더 — 안드로이드 Chrome은 `<iframe>` PDF를 인라인 렌더 못 하고 "열기" 스텁만 표시(데스크톱 Chrome은 정상, 이미지는 모바일도 정상). presign/Content-Type은 정상이며 브라우저 제약임. 옵션: (A) `react-pdf`(pdf.js) 앱 내 캔버스 렌더(데스크톱·모바일 공통, 번들↑) / (B) 모바일은 새 탭·뷰어로 열기(경량, 현 "새 탭에서 열기" 활용) / (C) 현행 유지. 데스크톱 실제 화면 확인 후 택일.

## 검색 결과 청크 그룹화 (후속)
- 증상: 키워드/의미 검색 결과가 청크 단위 row(키 `chunkId`)라 같은 문서가 여러 row로 중복 노출됨(예: 동일 문서 score 2.00·1.00, 의미검색 20건 대부분 동일 문서). 펼침은 단일 청크 카드 subrow.
- 목표: 결과를 `documentId`로 그룹화해 문서당 1 카드 + 청크 캐러셀(◀/▶·i/N·스와이프). 정렬: 그룹=최고 청크 score desc, 그룹 내=score desc. row 액션(선택/열기/폴더이동/다운로드/삭제)은 문서 단위 유지.
- 진행: **D19a 디자인 프로토타입 먼저 → 승인 후 D19b~d 실 기능/배선.**
- [x] D19a 디자인 프로토타입 페이지 — throwaway 라우트(`/design/search-grouped`)에 정적 더미 데이터로 "문서 그룹 카드 + 청크 캐러셀(◀/▶·i/N 인디케이터)" 비주얼만 구현. 실 데이터·배선 없음. 디자인 승인용.
- [x] D19b (승인 후) 그룹화 로직 — 검색 결과(청크 평면)를 `documentId`로 그룹화 + 정렬하는 프론트 변환 유틸(헤더용 최고 score·청크 수 포함).
- [x] D19c SearchResults 적용 — **3안(더보기 토글) 확정** 이식: 문서당 1 카드 + 첫 청크 노출 + "더보기/접기", row 액션 문서 단위 유지. 공통 규칙: 키워드=하이라이트, 의미=문서 keywords 해시태그(`useDocument`). 그룹화는 `lib/search-group.ts`. 프로토타입 라우트 제거.
- [x] D19d (승인 후) 아키텍처 — search-frontend §3a("청크 row 아래 카드형 subrow") 갱신.

## 검색 결과 화면 보정 (후속)
- [x] D20 검색 결과 세로 스크롤 — 키워드/의미(및 RAG) 결과가 스크롤 안 됨. 원인: `SearchResults`의 `ScrollArea`가 `flex-1`만 있고 `min-h-0` 없어 flex 자식이 콘텐츠보다 못 줄어 `overflow-hidden` 부모에 잘림(스크롤 불가). 수정: `ScrollArea`에 `min-h-0`(필요 시 루트 `flex h-full flex-col` 체인 점검). 전 모드 공통.
- [x] D21 RAG 결과 가로 오버플로우 — 답변 문장·인용 파일명이 화면 밖으로 잘림(스크린샷). 수정: `RagAnswer` 답변 `<p>`에 `min-w-0 break-words`, `CitationCard` 파일명 `truncate` 상위 flex span에 `min-w-0` 보강해 카드가 뷰포트 폭 내로 제한되게. (답변 컨테이너 flex도 `min-w-0` 확인.)
