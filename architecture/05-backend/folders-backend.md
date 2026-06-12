---
created: 2026-06-12
updated: 2026-06-12
status: draft
overview: 폴더 도메인의 백엔드 구현(API·모듈 흐름)을 정의한다.
refs: research/04 §1
---

# 폴더 백엔드

- 공통 구조·레이어링은 `backend.md`. 도메인 동작은 `folders.md`, 실 쿼리는 `folders-schema.md`.

## 1. API 계약
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/folders` | 소유자 폴더 트리를 평면 리스트로 조회한다. |
| POST | `/folders` | 폴더를 생성한다(`{parent_id?, name}`). |
| PATCH | `/folders/{id}` | 이름변경(`{name}`) 또는 이동(`{parent_id}`). |
| DELETE | `/folders/{id}` | 폴더를 재귀 삭제한다. |
- 에러: 형제 중복명 409, 사이클 이동 422, 권한 외 404. 모든 쿼리 `owner_id` 강제.

## 2. 모듈 흐름
- `folders/router → service → repository`.
- 트리 조회: repository가 재귀 CTE(folders-schema §4)로 평면 리스트 반환 → 프론트 트리 구성.
- 이동(MOVE): 사이클 방지 규칙은 folders.md §5, 검사 쿼리는 folders-schema §4. service가 후손 여부 확인 → 통과 시 단일 UPDATE를 트랜잭션 안에서 수행.
- 삭제: `ON DELETE CASCADE`로 하위 폴더·문서·청크 연쇄. 삭제 대상 문서의 `object_key`를 먼저 수집해 storage로 오브젝트 삭제 위임(document-backend.md).

## 3. 검증·권한
- 모든 조회/변경에 `owner_id` 조건 강제.
- 생성·이름변경 시 이름 길이·금지문자 검증. 루트=`parent_id NULL`.

## 4. 운영 배포 전 TODO
- 대용량 트리 조회 성능
  - 해결: [ ]
  - 비고: 필요 시 레벨별 lazy 조회로 전환(§2).
- 연쇄 삭제와 MinIO 정리 정합
  - 해결: [ ]
  - 비고: 오브젝트 삭제는 앱 책임(§2), 삭제 잡 멱등 보장.
