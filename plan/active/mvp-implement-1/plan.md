---
status: active
scope: mvp
arch_ref: architecture/00-README.md
---

# MVP 구현 플랜 #1

`architecture/` 설계를 기반으로 한 MVP 구현 작업 목록. 순서: **프론트 설계 → 인프라 → 백엔드 → 프론트 구현 → 테스트**.
각 항목은 완료 시 `[x]`로 체크. 세부 설계 근거는 해당 `architecture/NN` 참조.

> **전역 제약:** PG·MinIO 원격 고정(연결만, 로컬 중복 정의 금지). 시크릿은 `.env`(=`.gitignore`)로만. DB는 전용 스키마 `archive`. 드라이버 psycopg3 async.

---

## Phase 1 — 프론트엔드 설계 (arch 10)
백엔드 착수 전 UI/데이터 흐름을 먼저 확정해 API 계약을 역으로 검증.

- [ ] 1.1 컴포넌트 맵 확정 — AppShell(RSC) → ResizablePanels → Left/Center/Right + Search (arch 10 §4)
- [ ] 1.2 화면 와이어프레임(3패널 + 모바일 Sheet/Drawer) (§12)
- [ ] 1.3 상태 소유 정의 — react-query(서버 데이터) vs Zustand(선택/확장) 경계 (§6·§7)
- [ ] 1.4 API 계약 목록화 — 05~09의 엔드포인트를 프론트 관점에서 점검(누락/불일치 피드백)
- [ ] 1.5 디자인 토큰/Tailwind 4 테마·shadcn 컴포넌트 후보 선정(MCP 탐색) (§9)
- [ ] 1.6 presigned 3단계 업/다운로드 UX 플로우 정의 (arch 06 §4 정합)

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
- [ ] 4.1 Next.js 16 프로젝트 셋업(Tailwind 4, shadcn, `NEXT_PUBLIC_API_URL`)
- [ ] 4.2 AppShell(RSC) + ResizablePanels + `HydrationBoundary` 초기 시드
- [ ] 4.3 react-query 클라이언트 + Zustand 스토어 배선
- [ ] 4.4 Left — FolderTree(트리/선택/확장, CRUD/MOVE 드래그, 낙관 업데이트)
- [ ] 4.5 Center — DocumentList/Detail + UploadDropzone(presigned 3단계, 진행률)
- [ ] 4.6 인제스트 status/stage 폴링 표시(ready/failed 정지)
- [ ] 4.7 Right — MetadataEditor + GenerationHistory(생성 이력·폴링)
- [ ] 4.8 검색·AskDialog — 결과/인용 클릭 → 원문 딥링크, 요약/초안/보고서 생성 UI
- [ ] 4.9 반응형 — 모바일 단일 패널 + Sheet/Drawer
- [ ] 4.10 **MinIO 버킷 CORS 설정**(브라우저 presigned 호출용)

## Phase 5 — 테스트
- [ ] 5.1 백엔드 단위 — 폴더 사이클 방지, `owner_id` 스코프, presign 발급 권한
- [ ] 5.2 파이프라인 — 추출/OCR/청킹/임베딩 멱등·재시작, 부분 실패 격리
- [ ] 5.3 **검색 평가 게이트** — ~50 한국어 골든셋, Recall@5/@20(벡터only/하이브리드/+리랭크), 인용 존재 체크, CI 결정적 (arch 08 §11)
- [ ] 5.4 통합(E2E) — 업로드→인제스트→검색→RAG 답변→생성·계보 전 경로
- [ ] 5.5 프론트 — 핵심 플로우(트리 CRUD, 업/다운로드, 검색, 생성) + presigned/CORS 동작
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
