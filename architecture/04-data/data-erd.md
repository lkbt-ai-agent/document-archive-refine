---
created: 2026-06-12
updated: 2026-06-12
status: approved
overview: 도메인 엔티티 간 관계(ERD 대용)를 정의한다.
refs: research/01-mvp-research/01 §5.4, research/01-mvp-research/03 §4
---

# 관계 (ERD 대용)

## 1. 관계
- `users` 1—N `folders` (owns).
- `users` 1—N `documents` (owns).
- `folders` 1—N `folders` (self, parent).
- `folders` 1—N `documents` (contains).
- `documents` 1—N `document_chunks`.
- `generations` 1—N `generation_prompts`.
- `generations` 1—N `generation_source_documents`.
- `generations` 1—N `generation_source_chunks`.
- `generations` 1—N `generation_charts`.
- `generations` N—1 `models`.
- `generations` ↔ `documents`는 두 종류의 관계:
  - 입력(출처): `generations` N—M `documents` (`generation_source_documents` 경유) — 한 생성이 여러 원본을 섞으면 다대다.
  - 출력(산출물): `generations` 0—1 `documents` (`output_document_id`, materialize) — 생성 1회당 산출 문서 최대 1개, materialize 전이면 0.
