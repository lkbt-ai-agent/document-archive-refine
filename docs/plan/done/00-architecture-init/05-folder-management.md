---
created: 2026-06-10
completed: 2026-06-10
overview: docs/architecture/05 작성 플랜 — 인접 리스트 폴더 트리 CRUD·MOVE·재귀 조회/삭제(완료).
---

## 작성 단계
- [x] S1 개요/범위(Drive형 트리, owner 스코프).
- [x] S2 데이터 모델 참조(`folders`).
- [x] S3 트리 조회(재귀 CTE 평면 리스트).
- [x] S4 CRUD API 계약.
- [x] S5 MOVE + 사이클 방지(후손 검증).
- [x] S6 재귀 삭제(CASCADE + MinIO/청크/계보 정리 훅).
- [x] S7 권한·검증(owner_id, 루트 처리).
