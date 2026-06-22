---
created: 2026-06-12
updated: 2026-06-12
status: approved
overview: 폴더 테이블 스키마(인접 리스트)와 폴더 단위 삭제 정책을 정의한다.
refs: docs/research/01-mvp-research/04 §1
---

# 폴더 스키마

## 1. 테이블 DDL (인접 리스트, 스키마=archive)
```sql
CREATE TABLE archive.folders (                                          -- 폴더
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),                -- 폴더 ID
  parent_id  UUID REFERENCES archive.folders(id) ON DELETE CASCADE,     -- 상위 폴더 ID(루트=NULL)
  owner_id   UUID NOT NULL REFERENCES archive.users(id),                -- 소유자 ID
  name       TEXT NOT NULL,                                             -- 폴더명
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),                        -- 생성 일시
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),                        -- 수정 일시
  CONSTRAINT uq_folder_sibling_name UNIQUE (parent_id, owner_id, name)  -- 형제 폴더명 유일
);
CREATE INDEX ix_folders_parent_id ON archive.folders(parent_id);
```

## 2. 무결성·삭제 정책
- 폴더 삭제 → 하위 폴더·문서 연쇄 삭제 (도메인 규칙은 folders.md §6)
  - `folders` 한 행을 삭제하면, 그 폴더를 부모로 가리키는(`folders.parent_id` self-FK) 모든 하위 `folders` 행이 `ON DELETE CASCADE`로 자동 삭제되고, 손자·증손자까지 재귀로 이어진다.
  - 각 폴더에 속한(`documents.folder_id` FK) `documents`도 함께 삭제되며, 문서→청크 연쇄는 `documents-schema.md`.
- MinIO 오브젝트는 CASCADE 대상 아님(앱이 별도 삭제).

## 3. 제약·인덱스
- `parent_id` self-FK `ON DELETE CASCADE` — 부모 폴더 삭제 시 하위 폴더 연쇄 삭제(§2).
- `uq_folder_sibling_name(parent_id, owner_id, name)` — 같은 부모·같은 소유자 아래에서 형제 폴더 이름 중복 금지.
- `ix_folders_parent_id` — `parent_id` 기준 조회(자식 목록·재귀 CTE)를 빠르게 한다.

## 4. 쿼리 (트리 조회·MOVE 사이클 검사)
- 트리 조회: 소유자 전체 폴더를 재귀 CTE로 평면 리스트로 반환(도메인 동작은 folders.md §4).
```sql
WITH RECURSIVE tree AS (
  SELECT id, parent_id, name FROM archive.folders WHERE owner_id=:u AND parent_id IS NULL
  UNION ALL
  SELECT f.id, f.parent_id, f.name FROM archive.folders f JOIN tree t ON f.parent_id=t.id
) SELECT * FROM tree;
```
- 레벨별 lazy 조회: `SELECT ... FROM archive.folders WHERE parent_id = :id`.
- MOVE 사이클 검사: 새 부모가 옮길 폴더의 후손이면 거부(도메인 동작은 folders.md §5).
```sql
WITH RECURSIVE descendants AS (
  SELECT id FROM archive.folders WHERE id=:folder_id
  UNION ALL
  SELECT f.id FROM archive.folders f JOIN descendants d ON f.parent_id=d.id
)
SELECT EXISTS(SELECT 1 FROM descendants WHERE id=:new_parent_id);  -- TRUE면 거부
```
- MOVE 적용(검사 통과 후, 트랜잭션 내): `UPDATE archive.folders SET parent_id=:new_parent_id WHERE id=:folder_id`.

## 5. 설계 근거
- 인접 리스트(`parent_id`) + 재귀 CTE를 채택했다.
  - 폴더 이동이 해당 폴더 한 행의 `parent_id`만 바꾸는 단일 UPDATE로 끝난다(부모-자식 관계가 한 컬럼에만 담겨 하위 서브트리는 안 건드림).
  - 재귀 CTE(`WITH RECURSIVE`)는 임시 결과 집합이 자기 자신을 반복 참조해 계층을 펼치는 SQL 표준 기능. 부모→자식→손자를 한 쿼리로 따라간다.
  - 재귀 CTE는 원격 PostgreSQL 기본 기능이라 추가 확장이 필요 없다.
- 기각한 대안: 머티리얼라이즈드 패스 / ltree / 네스티드 셋 / 클로저 테이블.
  - 이동 시 서브트리 재작성이 필요하거나 복잡도가 높아 부적합.
