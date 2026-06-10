---
status: active
scope: mvp
arch_ref: architecture/00-README.md
---

# MVP 구현 플랜 #1

`architecture/` 설계를 기반으로 한 MVP 구현 작업 목록. 순서: **프론트 설계 → 인프라 → 백엔드 → 프론트 구현 → 테스트**.
각 항목은 완료 시 `[x]`로 체크. 세부 설계 근거는 해당 `architecture/NN` 참조.

> **전역 제약:** PG·MinIO 원격 고정(연결만, 로컬 중복 정의 금지). 시크릿은 `.env`(=`.gitignore`)로만. DB는 전용 스키마 `archive`. 드라이버 psycopg3 async.
>
> **구현 규약:** 각 모듈(라이브러리/프레임워크/SDK) 구현 시 **context7 MCP로 최신 공식 문서를 조회**해 API·설정·버전을 확인한 뒤 작성한다(메모리 의존 금지). 예: Next.js 16/React 19, Tailwind 4, shadcn, FastAPI, SQLAlchemy/Alembic, arq, pgvector/PGroonga, llama.cpp. UI 컴포넌트 선정은 shadcn MCP 병행(arch 10 §9).
>
> **코드 스타일 규약(React/TS):** 직접 작성하는 **모든 함수는 `function` 키워드 대신 화살표 함수(`const f = () => {}`)**, 객체/클래스 메서드는 **ES6 단축 표현**을 사용한다. **예외:** shadcn/ui 등 **외부 라이브러리가 생성·제공한 코드**(예: `components/ui/*`)는 원본 스타일 유지(개작 금지). (이 규약은 `web/AGENTS.md`에도 명시.)

---

## Phase 1 — 프론트엔드 설계 + UI 프로토타입 (arch 10)
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
- [ ] 1.10 **프로토타입 개정 (1.9 게이트 1차 검수 피드백)** — 아래 개정을 1.9 프로토타입 코드에 반영 후 재검수. 설계 변경은 arch에 역반영 완료(각 항목 참조). 코드 스타일은 상단 **코드 스타일 규약** 준수.
  - [ ] 1.10.1 **하단(Center 상세) 패널 제거 → 우측 패널로 통합.** Center는 문서 **목록 전용**. 상세 정보는 Right(DetailInspector)로 이관, **중복 기능 추가 금지**. **미리보기 영역 삭제**하고 **"원본 보기" 버튼**만: 텍스트류=마크다운 뷰어 다이얼로그, 그 외=presigned 다운로드. (arch 10 §4·§8·§10)
  - [ ] 1.10.2 **우측 패널 토글화** — 문서 row **선택** 또는 row **"⋯" 클릭** 시에만 열림(선택 해제 시 접힘). 참고 UX: shadcn `sidebar-demo`(base-nova). (arch 10 §8b)
  - [ ] 1.10.3 **등록일만 표시** — 문서는 인앱 편집이 없으므로 **수정일 비노출**, `created_at`(등록일)만 화면 표기. (arch 10 §10, arch 03 주석)
  - [ ] 1.10.4 **앱 타이틀 `Mechive`** — 브라우저 `<title>`/메타데이터·헤더 브랜드. (저장소·버킷명은 불변, 표시명만) (arch 10 §1)
  - [ ] 1.10.5 **새 폴더 다이얼로그** 프로토타입 — 이름 입력 → `POST /folders`. (arch 10 §8a, arch 05 §8)
  - [ ] 1.10.6 **좌측 폴더 "⋯" 드롭다운** — 폴더 행마다 **이동/이름 변경/삭제** 메뉴. (arch 10 §8a)
  - [ ] 1.10.7 **폴더 이동 다이얼로그** 프로토타입 — **폴더 트리 구조 표현 + 옮길 대상 상위 폴더 선택** 동선(자기·후손 비활성, 사이클 방지). `PATCH /folders/{id} {parent_id}`. (arch 10 §8a, arch 05 §6) *(요청 표기는 "이름 변경 다이얼로그"였으나 기술된 동선=MOVE이므로 이동 다이얼로그로 해석. 이름 변경 다이얼로그는 1.10.6의 별도 항목으로 분리.)*
  - [ ] 1.10.8 **메타데이터 읽기 전용 표시(보정 MVP 제외)** — AI가 생성한 메타(제목/요약/토픽/키워드)를 **input/저장 없이 그대로 표시**. 우측 패널 `MetadataEditor`→**읽기 전용 뷰**로 전환. 오입력 보정 방식(수동 입력 vs AI 프롬프트)은 **추후 결정**. 사례 분석은 `research/01-document-processing.md §8`로 이관. (arch 10 §7a)
  - [ ] 1.10.9 **모든 다이얼로그 모바일 풀스크린** — `<md`에서 Dialog 전체 화면(`w-screen h-dvh`, 라운드/마진 제거), 데스크톱은 중앙 모달. (arch 10 §12)
> **🚦 게이트(Phase 2 진입 전):** 1.9 프로토타입 + **1.10 개정** 반영본으로 **UI 동선 사용자 재검수** 필수. 승인 전 Phase 2 착수 금지.

## Phase 2 — 인프라 셋업 (arch 02)
원격 PG/MinIO 연결 검증 + 로컬 런타임(Redis·llama) 기동.

- [ ] 2.1 `.env` 키 카탈로그 작성(DATABASE_URL/MINIO_*/REDIS_URL/LLAMA_*/LLM_PROVIDER/DB_SCHEMA) (§4)
- [ ] 2.2 **DB 확장 가용성·권한 검증** — `pg_available_extensions` 확인, `CREATE EXTENSION vector/pgroonga` (§6, 선행 필수)
- [ ] 2.3 전용 스키마 `archive` 생성 + `search_path=archive,public` (§7)
- [ ] 2.4 원격 MinIO 연결·버킷 보장(`document-archive-refine`, 멱등) (§8)
- [ ] 2.5 Redis 기동(로컬 Docker `redis:7-alpine`) + `REDIS_URL` 주입 (§9)
- [ ] 2.6 llama-server 네이티브 기동 — 생성 8080 / 임베딩 8081(Mac mini Metal) (§9)
- [ ] 2.7 실행 구성 — api·worker·web·redis만 컨테이너/프로세스화(PG·MinIO 서비스 정의 금지) (§10)
- [ ] 2.8 헬스체크 — PG/MinIO/Redis/llama 연결 점검, PG/MinIO 실패 시 fail-fast (arch 04 §12)

## Phase 3 — 백엔드 구현 (arch 03·04·05·06·07·08·09)

### 3a. 기반 (arch 04)
- [ ] 3.1 모듈 스캐폴드 — `backend/src/{main,config,database,models}` + 도메인 패키지 (§4)
- [ ] 3.2 설정 — pydantic-settings로 `.env` 로드, 환경별 분리 (§7)
- [ ] 3.3 DB 와이어링 — async engine/sessionmaker, `get_session`, `expire_on_commit=False` (§6)
- [ ] 3.4 공통 규약 — 에러 모델/예외 핸들러, 페이지네이션, CORS, **`owner_id` 스코프 강제** (§8)

### 3b. 데이터 모델 (arch 03)
- [ ] 3.5 SQLAlchemy 모델 — Base(naming_convention), folders/documents/document_chunks/계보 (§5·§6)
- [ ] 3.6 Alembic(`-t async`) 초기화, `version_table_schema='archive'` (§8)
- [ ] 3.7 수동 마이그레이션 — 확장·ENUM·HNSW·PGroonga 인덱스 (§8)
- [ ] 3.8 `alembic upgrade head` 원격 적용 + `users` 시드 1명 (§3)

### 3c. AI Provider (arch 04 §9·§10)
- [ ] 3.9 `LLMClient`/`EmbeddingClient` Protocol + 팩토리(`LLM_PROVIDER`)
- [ ] 3.10 `LlamaCppLLM`/`LlamaCppEmbedding` 구현(KURE-v1 로컬 고정)
- [ ] 3.11 GBNF `--json-schema` 구조화 출력 공통 래퍼

### 3d. 폴더 (arch 05)
- [ ] 3.12 트리 조회(재귀 CTE 평면 리스트), CRUD
- [ ] 3.13 MOVE + 사이클 방지(후손 검증), 형제 중복명 409
- [ ] 3.14 재귀 삭제 — `object_key` 수집 → DB CASCADE → worker MinIO 삭제

### 3e. 스토리지 (arch 06)
- [ ] 3.15 MinIO 클라이언트(`secure=False`, 버킷 보장)
- [ ] 3.16 업로드 3단계 — Init(presigned PUT)/Upload/Confirm(`stat_object` 검증)
- [ ] 3.17 다운로드 presigned GET(RFC 5987 한글 파일명) + **발급 전 `owner_id` 검사**
- [ ] 3.18 삭제 수명주기(멱등), presign TTL 단축(5~15분) (§10 보안)

### 3f. 인제스트 파이프라인 (arch 07)
- [ ] 3.19 arq worker + 작업 enqueue, status/stage 멱등 갱신
- [ ] 3.20 파일타입 감지(magic bytes) → PDF 추출(pypdf + pdfplumber 표)
- [ ] 3.21 OCR — PaddleOCR → Tesseract(kor) 폴백, 페이지 단위·부분실패 격리
- [ ] 3.22 TXT/MD 처리(EUC-KR→CP949 안전 디코딩, MD 구조 보존)
- [ ] 3.23 메타 생성(intrinsic + NLP + LLM `{title,summary,topics,keywords}`)
- [ ] 3.24 청킹(512/64) + KURE-v1 임베딩(1024d) → `document_chunks` upsert

### 3g. 검색 & RAG (arch 08)
- [ ] 3.25 키워드 검색(PGroonga `&@~`, 폴백 tsvector)
- [ ] 3.26 의미 검색(HNSW cosine) + `hybrid_search` RRF(k=50) 단일 SQL
- [ ] 3.27 자연어→구조화 질의(GBNF) + Python 날짜 해석, `owner_id` 강제
- [ ] 3.28 RAG — 컨텍스트 조립 + 인용 강제 생성(`[n]↔chunk_id`), `/search`·`/search/ask`
- [ ] 3.29 (선택) 리랭커 토글(day-1 비활성)

### 3h. AI 산출물 & 계보 (arch 09)
- [ ] 3.30 비동기 생성 — `POST /generations`(202) + `generations(queued)` + enqueue
- [ ] 3.31 Summary(STUFF/MAP-REDUCE/HIERARCHICAL) 워크플로우
- [ ] 3.32 Draft(outline-then-expand) 워크플로우
- [ ] 3.33 Report — Python 통계 + Vega-Lite 스펙 + 검증·수리 루프(≤5)
- [ ] 3.34 계보 기록(provider/model/seed/프롬프트/출처/차트) + `/generations/{id}`·`/lineage`

## Phase 4 — 프론트엔드 구현 (arch 10)
> Phase 1 프로토타입(1.9 + **1.10 개정 반영본**)을 승계한다. 레이아웃은 **Left 트리 / Center 목록 / Right 토글 인스펙터**(하단 상세 패널 없음, arch 10 §4·§8).
- [ ] 4.1 Phase 1 프로토타입(`web`) 승계 — 목업 제거·실 API 배선 전환, `NEXT_PUBLIC_API_URL` 주입 (1.7·1.8·1.10 재사용)
- [ ] 4.2 AppShell(RSC, 브랜드명 **Mechive**) + ResizablePanels + `HydrationBoundary` 초기 시드
- [ ] 4.3 react-query 클라이언트 + Zustand 스토어 배선
- [ ] 4.4 Left — FolderTree(트리/선택/확장, CRUD/MOVE 드래그, 낙관 업데이트) + 폴더 **"⋯" 드롭다운(이동/이름변경/삭제)** + New/Rename/MoveFolder 다이얼로그 (arch 10 §8a)
- [ ] 4.5 Center — **DocumentList(목록 전용)** + UploadDropzone(presigned 3단계, 진행률). **등록일만 표시**(수정일 비노출, arch 10 §10)
- [ ] 4.6 인제스트 status/stage 폴링 표시(ready/failed 정지)
- [ ] 4.7 Right — **DetailInspector(토글형: row 선택/"⋯" 시 노출, §8b)** = DocumentDetail(status/stage + **"원본 보기"**: 텍스트=MD 뷰어/기타=다운로드, §10) + **MetadataView(읽기 전용, 보정 제외 §7a)** + GenerationTrigger/History(생성 이력·폴링)
- [ ] 4.8 검색·AskDialog — 결과/인용 클릭 → 원문 딥링크, 요약/초안/보고서 생성 UI
- [ ] 4.9 반응형 — PC·태블릿(Left 트리+Center 목록 상시 + **Right 토글 인스펙터**) / 모바일 단일+Sheet·Drawer + **모든 다이얼로그 모바일 풀스크린** (arch 10 §12)
- [ ] 4.10 라이트/다크 테마 — `next-themes` 토글 + 듀얼 토큰 적용, 시스템 추종·FOUC 방지 (arch 10 §3)
- [ ] 4.11 **MinIO 버킷 CORS 설정**(브라우저 presigned 호출용)

## Phase 5 — 테스트
- [ ] 5.1 백엔드 단위 — 폴더 사이클 방지, `owner_id` 스코프, presign 발급 권한
- [ ] 5.2 파이프라인 — 추출/OCR/청킹/임베딩 멱등·재시작, 부분 실패 격리
- [ ] 5.3 **검색 평가 게이트** — ~50 한국어 골든셋, Recall@5/@20(벡터only/하이브리드/+리랭크), 인용 존재 체크, CI 결정적 (arch 08 §11)
- [ ] 5.4 통합(E2E) — 업로드→인제스트→검색→RAG 답변→생성·계보 전 경로
- [ ] 5.5 프론트 — 핵심 플로우(트리 CRUD/이동 다이얼로그, 업/다운로드, 원본 보기, 검색, 생성) + 우측 인스펙터 토글 + presigned/CORS 동작 + **3단 반응형(다이얼로그 모바일 풀스크린)·라이트/다크 렌더 스모크**
- [ ] 5.6 재현성 검증 — provider/model/seed 기록으로 동일 생성 재실행

---

## 리스크 / 오픈 이슈
- 확장 `CREATE` 권한 부재 가능 → Phase 2.2 선행 차단점(실패 시 DBA 요청).
- MinIO http(비TLS)·공인 IP → presign TTL 단축·접근 제어, 운영 전 TLS 필수(arch 06 §10).
- llama-server Mac mini 가용성(개발 의존), HNSW 빌드 비용(원격 리소스).
- 임베딩 1024d 고정 — 변경 시 전량 재임베딩.

## 완료 기준 (DoD)
- [ ] 업로드→인제스트→검색/RAG→AI 산출물 전 경로가 원격 PG/MinIO 기준으로 동작.
- [ ] 로컬 PG/MinIO 신규 정의 없음(원격 연결만).
- [ ] 검색 평가 게이트 통과(목표 Recall 충족), 모든 생성에 계보 기록.
