---
created: 2026-06-12
updated: 2026-06-12
status: approved
overview: 폴더 테이블 스키마(인접 리스트)와 폴더 단위 삭제 정책을 정의한다.
refs: research/04 §1
---

# 폴더 스키마

## 1. 테이블 DDL (인접 리스트, 스키마=archive)
```sql
CREATE TABLE archive.folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES archive.folders(id) ON DELETE CASCADE,  -- root=NULL
  owner_id UUID NOT NULL REFERENCES archive.users(id),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_folder_sibling_name UNIQUE (parent_id, owner_id, name)
);
CREATE INDEX ix_folders_parent_id ON archive.folders(parent_id);
```

## 2. 무결성·삭제 정책
- 폴더 삭제 → 하위 폴더·문서 연쇄 삭제
  - `folders` 한 행을 삭제하면, 그 폴더를 부모로 가리키는(`folders.parent_id` self-FK) 모든 하위 `folders` 행이 `ON DELETE CASCADE`로 자동 삭제되고, 이게 손자·증손자까지 재귀적으로 이어진다.
  - 동시에 삭제되는 각 폴더에 속한(`documents.folder_id` FK) 모든 `documents` 행도 `ON DELETE CASCADE`로 함께 삭제되고, 그 문서들의 청크는 다시 연쇄 삭제된다(문서→청크 연쇄는 `documents-schema.md` 참고).
  - 즉 폴더 1개 삭제 = 그 아래 서브트리의 모든 폴더·문서·청크가 DB에서 한 번에 사라진다.
- MinIO 오브젝트는 CASCADE 대상 아님
  - 앱/worker가 별도 삭제(document-storage 정합)
