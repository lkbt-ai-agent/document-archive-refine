---
created: 2026-06-12
completed: 2026-06-12
overview: 도메인을 최상위 추상으로 두고 데이터·백엔드·프론트가 그 아래에서 참조하도록 문서 계층을 정리한다. 디렉토리 번호도 도메인 03 / 데이터 04로 바꾼다. 같은 개념의 정의는 도메인 한 곳이 정본이고, 하위 문서는 재서술 대신 참조한다.
---

# 도메인 우선 계층 정리 (중복 제거)

## 0. 핵심 변경
- 추상화 순서를 도메인 > 데이터로 둔다. 데이터 스키마는 도메인을 실현하는 하위 계층이다.
- 개념·상태·규칙의 정의는 도메인(03)이 정본이다. 하위 문서는 정의를 다시 쓰지 말고 도메인을 참조한다.
- 교차 관점(자연어/스키마/백엔드/프론트)은 중복이 아니다. 단, 참조 방향은 항상 하위 → 상위.

## 1. 계층
- Tier 1 — 03-domains: 도메인 행위·상태·프로세스·규칙의 정본(자연어).
- Tier 2 — 04-data: 도메인을 실현하는 스키마·제약·쿼리. 개념의 의미는 04를 참조한다.
- Tier 3 — 05-backend / 06-frontend: 구현. 04(행위)·03(데이터)·(05) API를 참조한다.
- 참조 규칙: 하위가 상위를 가리킨다. 정의는 가장 높은 Tier 한 곳에서만 선언한다.

## 2. 정본 소유
- 개념·규칙·상태는 도메인(03)이 소유한다.
  - 상태 수명주기(uploaded/processing/ready) → document.md
  - 인제스트 스테이지(extracting…embedding) → ingestion.md
  - 고아 정리 정책(의미) → document.md
  - 중복 파일 규칙(식별만, 차단 안 함) → document.md
  - 폴더 사이클 방지·연쇄 삭제 규칙 → folders.md
  - 검색 종류·인용·환각 억제 규칙 → search-and-rag.md
  - 생성 상태(queued/running…)·산출물 문서화 → ai-outputs.md
- 순수 데이터 구조는 데이터(04)가 소유한다(도메인에 대응 개념 없음).
  - DDL·컬럼 타입·인덱스 파라미터·명명 규약 → 각 *-schema, schema-rule
  - 실 쿼리(키워드/의미/RRF/CTE/upsert) → *-schema, search-schema
  - 고아 정리의 TTL·잡 구현, stat_object 같은 물리 메커니즘 → documents-minio
- 원칙: "무엇/왜"는 도메인, "어떻게(구조·쿼리·메커니즘)"는 데이터.

## 3. 진짜 중복 (통합)
- 상태 수명주기를 document.md와 ingestion.md가 각자 정의한다.
  - status는 document.md가 소유, stage는 ingestion.md가 소유로 분리.

## 4. 참조 방향 수정 (재서술 → 상위 참조)
- 데이터(04)가 도메인 의미를 재서술하는 곳 → 도메인 참조로 전환
  - documents-schema.md: status 의미·중복 규칙은 document.md 참조(컬럼·인덱스만 소유).
  - documents-minio.md §5: 고아 "정책"의 의미는 document.md 참조(TTL·잡 메커니즘만 소유).
  - generations-schema.md: output_document_id SET NULL의 의미(산출물 내역 비노출)는 ai-outputs.md §9 참조.
  - folders-schema.md: 연쇄 삭제·사이클의 의미는 folders.md 참조(제약·쿼리만 소유).
- 도메인(03)이 데이터를 "정책 권위"로 가리키는 역방향 표현 교정
  - document.md §4의 "정책은 documents-minio §5"를 의미는 document.md가 갖고, 구현만 documents-minio 참조로 문구 조정.
- 백엔드(05)가 도메인/데이터를 재서술하는 곳 → 상위 참조
  - ingestion-backend.md: 스테이지는 ingestion.md, 상태는 document.md 참조.
  - document-backend.md: 상태는 document.md, stat_object·고아는 documents-minio, sha256·멱등은 documents-schema 참조.
  - search-backend.md §5: 인용·환각 규칙은 search-and-rag.md §6 참조(구현 차이만).
  - ai-outputs-backend.md: 상태는 ai-outputs.md §8, materialization은 §9 참조(워크플로우 알고리즘만 소유).
  - folders-backend.md §2: 사이클 규칙은 folders.md §5, 쿼리는 folders-schema.md §4 참조.
- 프론트(06)는 이미 도메인/백엔드를 참조 중(추가 작업 없음).

## 5. 작업 항목
- [x] A1 ingestion.md §2 — status 정의 제거, document.md 참조. stage만 소유.
- [x] A2 documents-schema.md — status 의미·중복 규칙을 document.md 참조로, 컬럼·인덱스만 소유.
- [x] A3 documents-minio.md §5 — 고아 정책 의미는 document.md 참조, TTL·잡만 소유.
- [x] A4 document.md §4 — 고아·중복·상태를 도메인 정본으로 명확히 서술(데이터는 구현 참조로만).
- [x] A5 generations-schema.md — SET NULL 의미는 ai-outputs.md §9 참조.
- [x] A6 folders-schema.md — 연쇄·사이클 의미는 folders.md 참조.
- [x] A7 ingestion-backend.md — 스테이지/상태 재서술 축약, ingestion.md·document.md 참조.
- [x] A8 document-backend.md — 상태/stat_object/고아/sha256/멱등을 상위 참조로 축약.
- [x] A9 search-backend.md §5 — 인용·환각 재서술 제거, search-and-rag.md §6 참조.
- [x] A10 ai-outputs-backend.md — 상태·materialization 재서술 축약, ai-outputs.md §8·§9 참조.
- [x] A11 folders-backend.md §2 — 사이클 규칙은 folders.md §5 참조.

## 6. 검증
- [x] E1 개념·상태·규칙의 정의가 두 문서에 각자 존재하는 경우 0건(정본 1곳).
- [x] E2 하위(03/05/06)가 도메인 개념을 재서술하면서 상위 참조가 빠진 곳 0건.
- [x] E3 도메인(03)이 데이터(04)를 의미 권위로 가리키는 역방향 참조 0건.
- [x] E4 깨진 참조(없는 파일/절) 0건.

## 7. 비대상 (이미 적정)
- search-backend §3 → search-schema 참조.
- folders.md §2 설계근거 → folders-schema §5 참조.
- 프론트 도메인 문서·frontend.md 셸 포인터.

## 8. 디렉토리 재번호 (도메인 03 ↔ 데이터 04)
- 도메인이 데이터보다 위라는 계층을 디렉토리 번호에도 반영한다.
- 목표 순서: 01-overview, 02-infrastructure, 03-domains, 04-data, 05-backend, 06-frontend.
- 작업
  - [x] R1 `architecture/04-domains/` → `architecture/03-domains/` 이름 변경.
  - [x] R2 `architecture/03-data/` → `architecture/04-data/` 이름 변경.
  - [x] R3 경로 참조 갱신 — `00-README.md` 링크, `architecture/CLAUDE.md` 서브디렉토리 설명.
  - [x] R4 본문/플랜의 경로형 참조 갱신 — `04-domains/...`·`03-data/...`를 포함한 문구.
- 영향 범위
  - 파일명·절(`§`) 기반 참조는 무영향(경로 없는 `document.md` 등 대부분).
  - 경로형 참조(`./03-data/...`, `04-domains/...`)만 교정 대상.
- [x] R5 검증 — 잔여 `03-data`/`04-domains` 경로 0건, 깨진 링크 0건.
