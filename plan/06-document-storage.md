# 06. 문서 스토리지 (업로드/다운로드) — 작성 플랜

> **산출물:** `architecture/06-document-storage.md`
> **상태:** ⬜ Not started
> **근거 research:** `research/04 §2`
> **선행:** 03-data-model, 04-backend-application

## 목적
원격 MinIO를 사용한 presigned 업로드/다운로드 흐름, object key 설계, 문서 레코드 수명주기를 정의한다.

## 지켜야 할 제약 (스토리지 제약의 1차 책임자)
- **원격 MinIO**(`http://49.247.14.186:9000`, bucket `document-archive-refine`)에만 연결. 로컬 MinIO 정의 금지.
- presigned URL은 **원격 공인 엔드포인트**로 서명 → 서버·브라우저 동일 URL 사용(research의 internal/public 분리 불필요).

## 작성 단계 (= 아키텍처 문서 섹션)
- [x] S1. **개요/범위** — 대용량(스캔 PDF) 직접 업/다운로드, 서버 프록시 회피.
- [x] S2. **업로드 시퀀스** — (1) Init `POST /documents`(행 생성 status=uploaded + object_key + presigned PUT) → (2) 브라우저 직접 PUT → (3) Confirm `POST /documents/{id}/complete`(stat_object 검증 → status=processing → arq enqueue).
- [x] S3. **다운로드** — `GET /documents/{id}/download` → presigned GET(Content-Disposition에 한국어 원본명 RFC 5987 인코딩).
- [x] S4. **object key 설계** — `docs/{uuid}`(폴더 경로와 분리 → 폴더 MOVE/rename이 오브젝트 불변).
- [x] S5. **MinIO 클라이언트 구성** — 원격 endpoint/secure(http)/credentials(.env), 버킷 존재 보장(부트), presign TTL.
- [x] S6. **검증·무결성** — Confirm 시 size/mime/sha256 검증, 멱등(중복 Confirm 안전), 고아 오브젝트(업로드 미완) 정리 정책.
- [x] S7. **삭제 수명주기** — 문서 삭제 시 DB 레코드 + MinIO 오브젝트 + 청크/계보 정리 순서·실패 복구(05/03/09와 정합).

## 캡처할 핵심 결정 (research)
- presigned 양방향, key/폴더 분리.
- **보정:** 단일 원격 엔드포인트라 endpoint 분기 단순화.

## 다이어그램
- [x] 업로드 3단계 시퀀스(Mermaid sequenceDiagram) — 브라우저↔api↔원격 MinIO.
- [x] 다운로드 시퀀스.

## 제약·리스크·오픈 이슈
- [x] **비TLS(http) MinIO** — presigned URL/자격증명 평문 → TTL 단축, 운영 TLS 검토.
- [x] **공인 IP 직접 노출** — 버킷 정책/네트워크 접근 제어 확인.
- [x] **stat_object 신뢰** — 클라이언트 보고 크기와 실제 검증.

## 완료 기준
- [x] `architecture/06-*.md` 존재, S1~S7 충족.
- [x] **로컬 MinIO 정의 없음**, 원격 엔드포인트/버킷만 사용.
- [x] 업/다운로드·삭제 수명주기가 멱등·정합성 포함해 기술됨.
