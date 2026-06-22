---
created: 2026-06-10
completed: 2026-06-10
overview: architecture/06 작성 플랜 — 원격 MinIO presigned 업/다운로드·object key·문서 수명주기(완료).
---

## 작성 단계
- [x] S1 개요/범위(직접 업/다운로드, 서버 프록시 회피).
- [x] S2 업로드 3단계(Init→PUT→Confirm+enqueue).
- [x] S3 다운로드(presigned GET, RFC 5987 한글명).
- [x] S4 object key 설계(`docs/{uuid}`, 폴더와 분리).
- [x] S5 MinIO 클라이언트(원격 endpoint, 버킷 보장, TTL).
- [x] S6 검증·무결성(size/mime/sha256, 멱등, 고아 정리).
- [x] S7 삭제 수명주기(DB + 오브젝트 + 청크/계보).
