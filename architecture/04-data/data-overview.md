---
created: 2026-06-11
updated: 2026-06-12
status: approved
overview: 스키마 횡단 규칙을 정의한다.
refs: research/01-mvp-research/01 §5.4, research/01-mvp-research/03 §4, research/01-mvp-research/04 §1·§4b
---

# 데이터 모델 & 마이그레이션
- 본 문서는 전 도메인 공통의 횡단 관심사를 정의한다.
- 도메인 간 전체적인 관계는 `data-erd.md` 에 정의한다.
- 특정 도메인에 특화된 스키마, 정책, DDL 은 `domain-schema.md` 처럼 별도 파일로 분리한다.

## 1. 설계 결정
- 임베딩 차원 **1024** 전 시스템 통일, HNSW cosine.
  - HNSW: 근사 최근접 이웃(ANN) 벡터 인덱스(Hierarchical Navigable Small World)
  - cosine: 코사인 유사도 기준 거리(`vector_cosine_ops`).
- 계보는 행 단위 스냅샷(W3C PROV/Langfuse 정렬) — 모델/템플릿 변경이 과거 기록 미오염.
  - W3C PROV: 출처(provenance) 표현용 W3C 표준 데이터 모델
  - Langfuse: LLM 호출 추적·관측 플랫폼
  - 두 방식의 계보 표현(누가·무엇으로·무엇을 생성했나)에 맞춰 설계.
- 원격 공유 PostgreSQL DB 의 스키마 구분
  - 테이블: `archive`
  - 확장: `archive_ext`
- `users`는 인증 범위 밖(MVP) — 상세는 `users-schema.md`.

## 2. 명명 규약 & Base
- SQLAlchemy `MetaData(naming_convention={ix,uq,fk,pk,ck})`, `Mapped[]`+`mapped_column()`.
  - `naming_convention`: 인덱스·제약의 이름을 자동 생성하는 규칙. `ix`(인덱스)/`uq`(유니크)/`fk`(외래키)/`pk`(기본키)/`ck`(체크) 접두사를 일관 부여 → Alembic이 결정적 이름을 얻어 마이그레이션이 안정적.
  - `Mapped[]`+`mapped_column()`: SQLAlchemy 2.0 타입 annotation 매핑 방식. 컬럼을 파이썬 타입 힌트로 선언해 정적 타입 검사와 ORM 매핑을 일치시킨다.
- Pydantic v2 `ConfigDict(from_attributes=True)`, 상태는 `Literal[...]`.
  - `from_attributes=True`: ORM 객체 속성에서 바로 Pydantic 모델을 만들도록 허용(구 `orm_mode`) → API 응답 직렬화에 사용.
  - `Literal[...]`: 상태 필드를 정해진 문자열 집합으로 제한(예: `Literal['queued','running',...]`) → 잘못된 값 차단.

## 3. PostgreSQL DB 확장 의존 & 격리
- `vector`: 임베딩 저장·HNSW. 미가용 시 의미 검색 불가
- `pgroonga`: 한국어 키워드 검색. 미가용 시 `tsvector simple` 폴백(품질↓)
- 확장 스키마: `archive_ext` (§5 가용성 검증 선행)
- 테이블 스키마: `archive`

## 4. Alembic 전략
### 초기화
- `alembic init -t async` + `target_metadata=Base.metadata` + 모든 모델 import.
  - `-t async`: 비동기 드라이버(psycopg async)에 맞는 `env.py` 템플릿으로 생성.
  - `target_metadata=Base.metadata`: 변경 자동감지(autogenerate)가 모델 정의와 실제 DB를 비교하는 기준.
  - 모든 모델 import: import 안 된 모델은 metadata에 빠져 autogenerate가 누락되므로, 진입점에서 전 모델을 import해야 테이블을 빠짐없이 인식한다.
### 수동 마이그레이션
- 확장·특수 인덱스(HNSW·PGroonga 인덱스 객체)·ENUM 타입은 autogenerate가 처리 못 함.
  - 이유: 이들은 SQLAlchemy 메타데이터로 표현되지 않거나 부정확하게 감지된다.
  - 대응: 마이그레이션 스크립트에서 사람이 직접 `op.execute("CREATE INDEX ... USING hnsw ...")` 식으로 작성.
### 버전 격리·적용
- `version_table_schema='archive'`.
  - 적용 이력 테이블 `alembic_version` 는 `archive` 스키마에 둬 격리.
  - 적용은 `alembic upgrade head`(최신 리비전까지 전진), 되돌림은 `alembic downgrade`(이전 리비전으로 후퇴).

## 5. 운영 배포 전 TODO
- 확장 가용성·`CREATE` 권한 (선행 필수)
  - 해결: [ ]
  - 비고: 배포 전 아래 SQL로 가용성·권한 검증, 권한 거부 시 DBA에 사전 설치 요청.
    ```sql
    SELECT * FROM pg_available_extensions WHERE name IN ('vector','pgroonga');
    CREATE SCHEMA IF NOT EXISTS archive_ext;
    CREATE EXTENSION IF NOT EXISTS vector SCHEMA archive_ext;
    CREATE EXTENSION IF NOT EXISTS pgroonga SCHEMA archive_ext;
    ```
  - 미가용 영향: `vector` 없으면 의미 검색 불가, `pgroonga` 없으면 한국어 키워드 품질 저하(폴백 `tsvector simple`).
- HNSW 빌드 비용
  - 해결: [ ]
  - 비고: 원격 리소스 여유 확인.
