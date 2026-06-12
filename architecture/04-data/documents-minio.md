---
created: 2026-06-12
updated: 2026-06-12
status: draft
overview: 문서 오브젝트의 MinIO 저장 레이아웃 — object key 규약.
refs: research/04 §2
---

# 문서 오브젝트 저장 레이아웃 (MinIO)

- 백엔드 흐름(presigned·정리 잡·삭제·보안·설계)은 `document-backend.md`, 연결·버킷·자격증명은 infrastructure.

## 1. object key
- 키 형식 `docs/{uuid}`, 버킷 1개.
- 폴더 멤버십·표시명은 PostgreSQL이 보유 → 폴더 이동/이름변경이 오브젝트를 건드리지 않는다(키가 폴더 경로와 분리).
- `documents.object_key`(UNIQUE)·`documents.bucket` 컬럼이 이 키를 가리킨다(documents-schema.md §1).
