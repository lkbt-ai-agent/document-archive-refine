---
created: 2026-06-11
updated: 2026-06-11
status: draft
overview: 인접 리스트 기반 폴더 트리의 CRUD·MOVE·재귀 조회/삭제. 소유자 스코프(owner_id).
refs: research/04 §1
---

# 폴더 관리

## 1. 기능 요구사항
- 폴더 생성/이름변경/이동/삭제 + 트리 조회.

## 2. 설계 결정
- **인접 리스트(`parent_id`) + 재귀 CTE** 채택. MOVE=1행 update가 핵심.
- 기각: 머티리얼라이즈드 패스/ltree/네스티드 셋/클로저 테이블 — 서브트리 재작성·복잡도 부적합.
- 재귀 CTE는 원격 PG 기본 기능(추가 확장 불필요).

## 3. 데이터 모델 참조
`archive.folders`(data-model §4): self-FK `parent_id ON DELETE CASCADE`, `uq_folder_sibling_name(parent_id,owner_id,name)`, `ix_folders_parent_id`.

## 4. 트리 조회
- 재귀 CTE로 소유자 전체 폴더 평면 리스트 반환 → 프론트에서 `useMemo`로 트리 구성.
- 대규모 시 레벨별 lazy: `WHERE parent_id = :id`.
```sql
WITH RECURSIVE tree AS (
  SELECT id, parent_id, name FROM archive.folders WHERE owner_id=:u AND parent_id IS NULL
  UNION ALL
  SELECT f.id, f.parent_id, f.name FROM archive.folders f JOIN tree t ON f.parent_id=t.id
) SELECT * FROM tree;
```

## 5. MOVE (재부모) + 사이클 방지
1. update 전 재귀 CTE로 대상이 자기 후손이 아님을 검증.
2. 후손이면 거부(422), 아니면 `UPDATE folders SET parent_id=:new_parent_id WHERE id=:folder_id` (트랜잭션 내).
```sql
WITH RECURSIVE descendants AS (
  SELECT id FROM archive.folders WHERE id=:folder_id
  UNION ALL
  SELECT f.id FROM archive.folders f JOIN descendants d ON f.parent_id=d.id
)
SELECT EXISTS(SELECT 1 FROM descendants WHERE id=:new_parent_id);  -- TRUE면 거부
```

## 6. 재귀 삭제
- `ON DELETE CASCADE`로 하위 폴더·문서·청크 연쇄.
- MinIO 오브젝트는 CASCADE 대상 아님 → service가 삭제 대상 문서의 `object_key`를 먼저 수집 → DB 삭제 후 worker가 오브젝트 삭제(document-storage 정합).

## 7. API 계약
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/folders` | 소유자 트리(평면 리스트) |
| POST | `/folders` | 생성 `{parent_id?, name}` |
| PATCH | `/folders/{id}` | 이름변경 `{name}` / 이동 `{parent_id}` |
| DELETE | `/folders/{id}` | 재귀 삭제 |

에러: 형제 중복명 409, 사이클 이동 422, 권한 외 404.

## 8. 권한·검증
모든 쿼리 `owner_id` 강제. 이름 길이/금지문자 검증. 루트=`parent_id NULL`.

## 9. 운영 배포 전 TODO
- 대용량 트리 재귀 CTE 성능
  - 해결: [ ]
  - 비고: 필요 시 레벨별 lazy 조회로 전환(§4).
- CASCADE ↔ MinIO 정리 정합
  - 해결: [ ]
  - 비고: 오브젝트 삭제는 앱 책임(§6), 삭제 잡 멱등 보장.
