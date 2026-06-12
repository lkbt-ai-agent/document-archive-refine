---
created: 2026-06-12
completed: 2026-06-12
overview: 03-domains에 뒤섞인 관심사를 4개 레이어로 재분배·재작성한다. 04-data=스키마/쿼리, 03-domains=상태·프로세스(자연어), 05-backend=도메인별 구현, 06-frontend=도메인별 구현.
---

# 도메인 문서 관심사 재분배

## 0. 목표 & 레이어 규칙
- 도메인 5개: folders / document / ingestion / search-and-rag / ai-outputs.
- 각 도메인 내용을 레이어별 관심사로 분리한다.
  - 04-data
    - PostgreSQL/MinIO 스키마·DDL·실 쿼리.
    - 이미 도메인별로 분리됨. 갭만 보강.
  - 03-domains
    - 상태 정의 + 프로세스 단계.
    - 자연어만. 구현 스펙·라이브러리·SQL·API 표 금지.
    - 04-data 참조 가능.
  - 05-backend
    - 도메인별 `<domain>-backend.md`.
    - 상태/프로세스의 백엔드 구현. API 규약, 모듈 호출 흐름.
    - 03·04 참조 가능.
  - 06-frontend
    - 도메인별 `<domain>-frontend.md`.
    - 브라우저 모듈 호출 흐름·상태 관리.
    - 03~05 참조 가능.
- 현재 문제
  - 04는 SQL/API/라이브러리가 혼재한다.
  - 05·06은 단일 모놀리식(`backend-application.md`·`frontend-drive-ui.md`)이라 도메인 분리가 안 됐다.

## 1. 타깃 파일 트리
- 04-data
  - 유지: schema-rule, erd, users-schema, folders-schema, documents-schema, documents-minio, generations-schema
  - 신규: search-schema (키워드/의미/하이브리드 실 쿼리)
- 03-domains
  - 유지(자연어로 정제): folders, document, ingestion, search-and-rag, ai-outputs
- 05-backend
  - 공통 유지: `backend.md` (← backend-application 이름 변경)
  - 신규: folders-backend, document-backend, ingestion-backend, search-backend, ai-outputs-backend
- 06-frontend
  - 공통 유지: `frontend.md` (← frontend-drive-ui 이름 변경)
  - 신규: folders-frontend, document-frontend, search-frontend, ai-outputs-frontend
  - ingestion 프론트는 폴링 표시뿐이라 document-frontend에 흡수
- 공통(비도메인) 문서는 골격만 남긴다.
  - `backend.md`: 모듈 구조·레이어링·세션·설정·공통 API 규약·Provider 추상화·헬스체크.
  - `frontend.md`: 셸/레이아웃 맵·RSC 분리·react-query↔Zustand 경계·테마·반응형·브랜드.

## 2. 관심사 분류 기준 (무엇이 어디로)
- CREATE TABLE/INDEX, 컬럼·제약, ENUM → 04-data `*-schema`
- 실 SQL(키워드/RRF/CTE/upsert) → 04-data `*-schema`
- 상태값 정의·전이 의미 → 03-domains(자연어)
- 프로세스 단계 흐름 → 03-domains(자연어)
- 도메인 규칙·제약(소유권, 사이클 금지, 인용 강제) → 03-domains(자연어)
- 라이브러리·도구·파라미터 → 05-backend `<domain>-backend`
- API 계약(경로·요청·응답) → 05-backend `<domain>-backend`
- 백엔드 모듈 호출 흐름(router→service→repo→storage/ai/queue) → 05-backend `<domain>-backend`
- 컴포넌트·react-query/Zustand·UX 동작 → 06-frontend `<domain>-frontend`
- 횡단(레이어링·Provider 추상화 / 셸·테마·반응형) → 05/06 공통 문서

## 3. Phase A — 04-data 보강
- [x] A1 `search-schema.md` 신설
  - search-and-rag의 키워드 SQL·의미검색 식·`hybrid_search` RRF SQL을 이관.
  - 인덱스(PGroonga `documents.content`, HNSW `document_chunks`)는 documents-schema 참조.
- [x] A2 ingestion 데이터 갭 확인
  - 청크 upsert(`INSERT ... ON CONFLICT (document_id, chunk_index)`)를 documents-schema의 `document_chunks` 쿼리로 추가.
  - 신규 파일은 불필요.
- [x] A3 folders 데이터 모델 설계근거 이관
  - 04 folders의 "인접 리스트+재귀 CTE 채택 / 대안 기각"을 folders-schema로 이동.
  - 04엔 동작만 남긴다.
- [x] A4 검증 — 03-domains의 SQL 코드블록이 0개가 되도록 04-data가 모든 쿼리를 보유하는지 확인.

## 4. Phase B — 03-domains 정제 (자연어 상태·프로세스만)
- 각 문서에서 SQL은 A로, API 표·라이브러리·파라미터는 C로 뺀다.
- 남는 골격: 기능 요구사항 / 상태 정의 / 프로세스 단계 / 도메인 규칙 / (TODO).
- `## 2. 설계 결정` 절은 항목별로 분해해 분산한다.
  - folders
    - 인접 리스트+재귀 CTE 채택, 대안 기각 → 04-data folders-schema
    - MOVE=1행 update → 04 동작으로 잔류
  - document
    - presigned 직접 전송, object key `docs/{uuid}`, 엔드포인트 단일화 → 04-data documents-minio
  - ingestion
    - arq+Redis, pypdf·pdfplumber, KURE-v1 1024d 등 → 05 ingestion-backend
    - 차원 lock-in 원칙만 schema-rule
  - search-and-rag
    - PGroonga TokenBigram, RRF k=50, GBNF → 05 search-backend (k=50은 search-schema 쿼리와 함께)
    - `owner_id` 항상 강제 → 04 도메인 규칙으로 잔류
  - ai-outputs
    - Vega-Lite 선언형, 산술은 Python → 05 ai-outputs-backend
    - 계보 행 단위 스냅샷, 인용 `[n]↔chunk_id` 강제 → 04 도메인 규칙으로 잔류 (DDL은 generations-schema)
  - 기준: 구현을 알아야 바뀌는 내용이면 04에서 제거.
- [x] B1 folders
  - 트리 조회·MOVE(사이클 금지)·재귀 삭제·권한을 동작으로 유지.
  - 설계근거는 A3, API는 C1로.
- [x] B2 document
  - 업/다운/삭제 프로세스, `documents.status` 수명주기, 고아 정리 동작, 메타 보유를 자연어로 유지.
  - presigned/object key/엔드포인트 설계는 documents-minio 참조. API는 C2로.
- [x] B3 ingestion
  - 상태(`uploaded→processing→ready|failed`)·스테이지(`extracting→…→embedding`) 정의와 단계 흐름만 자연어로.
  - 단계 흐름: 타입감지→추출→OCR→메타→청킹→임베딩→저장, 멱등·부분실패 격리.
  - 라이브러리 전부(pypdf·pdfplumber·PaddleOCR·Tesseract·Qwen·charset-normalizer·KURE·512/64·magic bytes·GBNF)는 C3로.
- [x] B4 search-and-rag
  - 검색 종류 정의(키워드/의미/하이브리드/RAG)·RAG 프로세스 단계·인용/환각억제 규칙·평가게이트 개념만.
  - SQL은 A1, 도구·파라미터(PGroonga·RRF k=50·GBNF·bge-reranker)는 C4, API는 C4로.
- [x] B5 ai-outputs
  - 워크플로우 단계(Summary/Draft/Report) 정의·생성 상태(`queued→running→succeeded|failed`)·계보 개념·재현성 개념·산출물 문서화를 자연어로.
  - 산출물 문서화: 1급 문서·산출물 내역·삭제 정합.
  - 분기 임계값·Vega-Lite·수리 루프·seed/decode는 C5, 계보 DDL은 generations-schema, API는 C5로.

## 5. Phase C — 05-backend 도메인 분리
- [x] C0 `backend-application.md` → `backend.md`로 이름 변경 후 공통만 남김
  - 모듈 구조·레이어링·DB 세션·설정·공통 API 규약·Provider 추상화·구조화 출력 래퍼·비동기 작업 인터페이스·헬스체크.
  - 도메인 API/흐름은 아래로 이관.
- [x] C1 `folders-backend.md`
  - API: `GET/POST/PATCH/DELETE /folders`.
  - 흐름: router→service→repository, 재귀 CTE 호출, service 사이클 검사, 트랜잭션.
  - 에러 매핑: 409/422/404.
- [x] C2 `document-backend.md`
  - API: `/documents` CRUD·`/complete`·`/download`.
  - 흐름: documents service ↔ storage(minio_client) ↔ queue(arq enqueue).
  - upload init/confirm·`stat_object` 검증·고아 정리 잡·`owner_id` 스코프.
- [x] C3 `ingestion-backend.md`
  - arq 워커 구현: 스테이지 오케스트레이션.
  - 라이브러리 선택: 추출/OCR 폴백 체인/메타/청킹 파라미터.
  - Provider 임베딩 호출, 청크 upsert.
  - 멱등 키 `(document_id, stage)`·백오프 재시도·`status/stage` 갱신.
- [x] C4 `search-backend.md`
  - API: `/search`·`/search/ask`.
  - 흐름: GBNF 질의 파싱→키워드/의미/하이브리드 SQL→리랭크 토글→컨텍스트 조립→인용 생성.
  - RRF/리랭커 파라미터, 평가 게이트(CI).
- [x] C5 `ai-outputs-backend.md`
  - API: `/generations`·`/{id}`·`/{id}/lineage`·목록.
  - 워크플로우 구현: 길이 분기·map-reduce·hierarchical·outline-expand·report(통계 Python+Vega-Lite 생성+수리 루프).
  - 비동기 생성(202·worker·상태), 계보·스냅샷 기록, 산출물 materialize(문서화+인제스트).

## 6. Phase D — 06-frontend 도메인 분리
- [x] D0 `frontend-drive-ui.md` → `frontend.md`로 이름 변경 후 셸/공통만 남김
  - 레이아웃 맵·AppShell/패널·RSC 분리·react-query↔Zustand 경계·테마·반응형·브랜드 "Mechive".
  - 도메인 컴포넌트 슬라이스는 아래로 이관하되 레이아웃 맵은 링크로 참조.
- [x] D1 `folders-frontend.md`
  - FolderTree·FolderActions·New/Rename/Move 다이얼로그.
  - 평면리스트→`useMemo` 트리, 낙관 업데이트·롤백, Zustand 선택/확장.
- [x] D2 `document-frontend.md`
  - DocumentList(Table+TanStack·서버 페이지네이션·react-query).
  - 업로드 dropzone(presigned 3단계)·다운로드/원본 보기.
  - DocumentDetail + 인제스트 `status/stage` 폴링 표시(ingestion 프론트 흡수), 등록일 표기.
- [x] D3 `search-frontend.md`
  - SearchBar/SearchResults 다이얼로그·AskDialog(RAG).
  - 인용 딥링크, `elapsed_ms` 표시, auto-grow textarea.
- [x] D4 `ai-outputs-frontend.md`
  - GenerationTrigger 다이얼로그·ArtifactList "산출물 내역".
  - 계보(Lineage) 인스펙터 섹션·차트 렌더(react-vega)·산출물 문서 이동.

## 7. Phase E — 크로스레퍼런스 재배선 & 색인
- [x] E0 이름 변경 참조 갱신
  - `backend-application`→`backend`, `frontend-drive-ui`→`frontend`.
  - `backend-application §8·§9·§11`, `frontend-drive-ui §7a·§11` 등 arch·plan·README 전부.
- [x] E1 API 이전 참조 갱신
  - 04→05 이동으로 무효해지는 API 참조 전수 교정.
  - 대상: `search-and-rag §11`·`ai-outputs §10`·`folders §7`·`document §5`(API) → 각 `<domain>-backend.md`.
- [x] E2 03-domains 절 번호 영향
  - SQL/API 제거로 번호가 바뀌는 문서의 외부 참조 교정.
  - 가능하면 절을 유지해 번호를 보존한다.
- [x] E3 06-frontend 분리 영향
  - `frontend §7a/§8a/§8b/§11` 등 내부·외부 참조를 분리된 도메인 프론트 문서로 재배선.
- [x] E4 `00-README.md` 색인 갱신 — 신규 03/05/06 파일 전부 등재.
- [x] E5 전수 검증
  - 깨진 참조(없는 파일/절) 0건.
  - 레이어 규칙 위반(04에 SQL/표, 05/06에 도메인 혼재) 0건.

## 8. 확정 사항
- 공통 문서 유지+이름 변경
  - 도메인 비종속 공통을 `backend.md`·`frontend.md`로 유지.
  - 레이어링·Provider 추상화 / 셸·테마는 도메인에 안 묶인다.
- ingestion 프론트 흡수
  - 프론트 관심사가 폴링 표시뿐이라 document-frontend로 흡수.
- 04 설계 결정 분해
  - 데이터 설계 근거는 03, 도구·파라미터는 05, 순수 규칙만 04. (매핑은 §4)
- 신규 파일은 draft로 생성 후 검토하고 approved로 승격.
- 절 번호는 보존을 우선하고, 불가피한 재번호는 참조까지 일괄 갱신한다.
