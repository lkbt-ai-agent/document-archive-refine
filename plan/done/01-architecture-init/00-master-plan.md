# 00. 아키텍처 설계 문서 작성 마스터 플랜

이 디렉터리(`plan/`)는 **`architecture/` 아래에 작성할 아키텍처 설계 문서**를 만들기 위한 단계별 작업 계획이다.
각 플랜 파일은 산출물 아키텍처 문서 1개와 1:1로 대응하며, 모든 단계는 체크박스(`- [ ]`)로 표기되어 나중에 완료 여부를 점검할 수 있다.

- **입력(근거):** `research/00~06` 세부 설계 보고서.
- **출력(산출물):** `architecture/01~10` + `architecture/00-README.md`(색인).
- **이 문서의 역할:** 전체 문서 목록, 작성 순서·의존성, 공통 규약, 전역 제약, 전역 완료 기준(Definition of Done)을 정의한다.

---

## 0. 전역 제약 (모든 아키텍처 문서가 반드시 지킬 것)

> ⚠️ **research와의 핵심 차이 — 반드시 반영.**
> `research/04 §6`은 PostgreSQL·MinIO를 **로컬 Docker Compose**로 띄우는 구성을 제안하지만, 본 프로젝트에서는 **PostgreSQL과 MinIO가 원격 서버에 이미 배포**되어 있다(접속 정보는 루트 `.env`).
> 따라서 아키텍처 문서는 **원격 연결만 설계**하고, **로컬 PostgreSQL/MinIO를 중복 provisioning하지 않는다.**

| 항목 | 값(.env 기준) | 처리 원칙 |
|---|---|---|
| PostgreSQL | `postgresql+psycopg://mirimiriuser:***@49.247.14.186:5432/mirimiri` | **원격 기존 인스턴스에 연결만.** 로컬 DB 컨테이너 설계 금지 |
| MinIO | `http://49.247.14.186:9000`, bucket `document-archive-refine` | **원격 기존 인스턴스에 연결만.** 로컬 MinIO 컨테이너 설계 금지 |
| Redis | `.env`에 없음 | arq 큐에 필요 → **별도 provisioning 대상**(로컬/원격은 결정 필요, 제약 대상 아님) |
| llama-server | `.env`에 없음 | 모델 런타임은 네이티브 실행, URL은 설정으로 주입 |

추가 전역 원칙:
- **시크릿 취급:** `.env`에는 실제 자격증명이 들어 있다. 문서에 평문 비밀번호를 복붙하지 말고 `${DATABASE_URL}` 등 **환경변수 참조**로 표기한다. `.env`는 `.gitignore` 대상임을 명시한다.
- **공유 원격 DB 주의:** `mirimiri` DB는 다른 용도와 공유될 수 있다 → **전용 스키마(schema) 또는 테이블 접두어** 전략을 데이터 모델 문서에서 결정한다.
- **확장 가용성 리스크:** 설계는 `pgvector`·`PGroonga` 확장에 의존한다. 원격 DB에 두 확장이 설치/활성화 가능한지(권한 포함) **검증 단계**를 인프라·데이터모델 문서에 포함한다.
- **드라이버:** `.env`는 `postgresql+psycopg`(psycopg3)인데 research는 `asyncpg`를 가정했다 → 드라이버 결정을 명시(기본: `.env`에 맞춰 psycopg3 async 사용).

---

## 1. 작성할 아키텍처 문서 목록 & 진행 현황

| # | 아키텍처 문서(`architecture/`) | 플랜 파일(`plan/`) | 근거 research | 상태 |
|---|---|---|---|---|
| 01 | `01-system-overview.md` | [`01-system-overview.md`](./01-system-overview.md) | 00, 04, README | ✅ |
| 02 | `02-infrastructure-and-environment.md` | [`02-infrastructure-and-environment.md`](./02-infrastructure-and-environment.md) | 00 §0, 04 §6 | ✅ |
| 03 | `03-data-model-and-migrations.md` | [`03-data-model-and-migrations.md`](./03-data-model-and-migrations.md) | 01 §5.4, 03 §4, 04 §1·4b | ✅ |
| 04 | `04-backend-application.md` | [`04-backend-application.md`](./04-backend-application.md) | 04 §0·3, 02 전반 | ✅ |
| 05 | `05-folder-management.md` | [`05-folder-management.md`](./05-folder-management.md) | 04 §1 | ✅ |
| 06 | `06-document-storage.md` | [`06-document-storage.md`](./06-document-storage.md) | 04 §2 | ✅ |
| 07 | `07-document-processing-pipeline.md` | [`07-document-processing-pipeline.md`](./07-document-processing-pipeline.md) | 01 전반, 04 §4 | ✅ |
| 08 | `08-search-and-rag.md` | [`08-search-and-rag.md`](./08-search-and-rag.md) | 02 전반 | ✅ |
| 09 | `09-ai-outputs-and-lineage.md` | [`09-ai-outputs-and-lineage.md`](./09-ai-outputs-and-lineage.md) | 03 전반 | ✅ |
| 10 | `10-frontend-drive-ui.md` | [`10-frontend-drive-ui.md`](./10-frontend-drive-ui.md) | 04 §5 | ✅ |
| — | `00-README.md`(색인) | (본 마스터 플랜 §4 최종 단계) | README | ✅ |

> 진행 시 상태 칸을 ⬜ → 🟡(작성 중) → ✅(완료)로 갱신한다.

---

## 2. 작성 순서 & 의존성

```
01 시스템 개요
   └→ 02 인프라/환경 ──┐
        └→ 03 데이터 모델/마이그레이션 ──┐
             └→ 04 백엔드 애플리케이션(+Provider 추상화) ──┐
                  ├→ 05 폴더 관리
                  ├→ 06 문서 스토리지
                  │     └→ 07 문서 처리 파이프라인
                  │            └→ 08 검색 & RAG
                  │                   └→ 09 AI 산출물 & 계보
                  └→ 10 프론트엔드(모든 API 확정 후)
```

- **01→02→03→04**는 기반 문서이므로 순서대로 먼저 작성한다.
- **05~09**는 기능 문서로, 04 확정 후 병렬 작성 가능(단 07→08→09는 데이터 흐름상 순서 권장).
- **10 프론트엔드**는 백엔드 API 계약이 정해진 뒤 마지막에 작성한다.

---

## 3. 공통 문서 규약 (각 아키텍처 문서가 따를 형식)

각 `architecture/NN-*.md`는 다음 골격을 따른다:

```markdown
# NN. <기능명> 아키텍처

## 1. 개요 / 범위 (이 문서가 다루는 것/안 다루는 것)
## 2. 요구사항 매핑 (requirement TODO ↔ 본 설계)
## 3. 설계 결정 (결정 / 근거 / 대안 / 트레이드오프)
## 4. 상세 설계 (컴포넌트·데이터·인터페이스·시퀀스)
## 5. 인터페이스 계약 (API / 스키마 / 함수 시그니처)
## 6. 다이어그램
## 7. 제약·리스크·오픈 이슈
## 8. 참고 (research 링크, 용어집)
```

- **언어:** 한국어(기존 research와 일관).
- **다이어그램:** Mermaid 우선(`flowchart`, `sequenceDiagram`, `erDiagram`), 불가 시 ASCII.
- **용어:** 처음 쓰는 용어는 `research/06-glossary.md`를 참조(링크 대신 괄호 한 줄 설명 권장).
- **추적성:** 각 결정에 근거 research 위치(`research/0X §Y`)를 표기.
- **코드 예시:** 스키마·인터페이스는 research의 SQL/Python을 재사용하되, **원격 인프라 제약**에 맞게 수정.

---

## 4. 전역 완료 기준 (Definition of Done)

- [x] `plan/01`~`plan/10` 플랜 파일이 모두 존재한다. *(본 작업의 1차 산출물)*
- [x] `architecture/01`~`architecture/10` 문서가 각 플랜의 단계·완료 기준을 충족한다.
- [x] 모든 문서가 §3 공통 규약 골격을 따른다.
- [x] **로컬 PostgreSQL/MinIO를 신규로 정의한 곳이 한 군데도 없다**(원격 연결만).
- [x] `pgvector`/`PGroonga` 확장 가용성, Redis provisioning, 드라이버(psycopg3) 결정이 인프라·데이터모델 문서에 명시된다.
- [x] 최종 단계로 `architecture/00-README.md`(문서 색인 + TL;DR 결정표)를 작성한다.
- [x] 마스터 플랜 §1 진행 표가 모두 ✅로 갱신된다.
```
