---
created: 2026-06-12
updated: 2026-06-12
status: draft
overview: 문서 도메인의 백엔드 구현 — API 계약과 모듈 호출 흐름. 도메인 정의는 document.md, 스키마는 documents-schema/documents-minio.
refs: research/04 §2
---

# 문서 백엔드

- 공통 구조는 `backend.md`. 도메인 동작은 `document.md`, 스키마·물리 저장은 `documents-schema.md`·`documents-minio.md`.

## 1. API 계약
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/documents?folder_id=&limit=&cursor=` | 폴더 내 문서 목록을 페이지네이션으로 조회한다. |
| GET | `/documents/{id}` | 문서 상세(`documents` 메타 + `status`/`stage`/`error`)를 조회한다. |
| POST | `/documents` | upload init: `uploaded` 행을 생성하고 presigned PUT을 발급한다. |
| POST | `/documents/{id}/complete` | upload confirm: `stat_object`로 검증하고 `processing` 전이 + 인제스트 enqueue. |
| PATCH | `/documents/{id}` | 문서를 지정 폴더로 이동한다(`{folder_id}`). |
| DELETE | `/documents/{id}` | 삭제 수명주기를 실행한다. |
| GET | `/documents/{id}/download` | presigned GET을 발급한다(발급 전 `owner_id` 검사). |
- 에러: 권한 외 404, 이동 충돌은 폴더 정책 준수, upload confirm 검증 실패 4xx. 모든 쿼리 `owner_id` 강제.

## 2. 모듈 흐름
- `documents/router → service → repository`, service가 `storage`(minio_client)·`queue`(arq) 호출.
- upload init: documents 행(`uploaded`)·`object_key` 생성 → storage가 presigned PUT 발급.
- upload confirm: storage `stat_object`로 존재·크기 검증 → `processing` 전이 → 인제스트 enqueue(pipeline).
- download: `owner_id` 검사 → storage presigned GET 발급.
- delete: `object_key` 수집 → DB 삭제(청크 CASCADE) → storage 오브젝트 삭제(재시도·멱등).

## 3. 고아 정리
- presigned PUT TTL(5~15분) 만료로 미완 업로드를 차단.
- 주기 잡(arq)이 일정 기간 `uploaded`로 방치된 행을 `stat_object` 부재 확인 후 삭제(documents-minio.md §5).

## 4. 무결성
- 인제스트 중 `sha256` 계산(중복 식별, 차단 안 함).
- 멱등: 중복 upload confirm은 이미 `processing`/`ready`면 무시.
