---
created: 2026-06-12
updated: 2026-06-15
status: approved
overview: 문서 도메인의 백엔드 구현(API·presigned·고아 방지·보안)을 정의한다.
refs: docs/research/01-mvp-research/04 §2
---

# 문서 백엔드

## 1. API 계약

| 메서드 | 경로                                   | 설명                                                                           |
| ------ | -------------------------------------- | ------------------------------------------------------------------------------ |
| GET    | `/documents?folder_id=&limit=&cursor=` | 폴더 내 문서 목록을 페이지네이션으로 조회한다.                                 |
| GET    | `/documents/{id}`                      | 문서 상세(`documents` 메타 + `status`/`stage`/`error`)를 조회한다.             |
| POST   | `/documents`                           | upload init: `uploaded` 행을 생성하고 presigned PUT을 발급한다.                |
| POST   | `/documents/{id}/complete`             | upload confirm: `stat_object`로 검증하고 `processing` 전이 + 인제스트 enqueue. |
| PATCH  | `/documents/{id}`                      | 부분 갱신: 폴더 이동(`{folder_id}`)·현재 파일명 변경(`{display_filename}`).    |
| DELETE | `/documents/{id}`                      | 삭제 수명주기를 실행한다.                                                      |
| GET    | `/documents/{id}/download`             | presigned GET을 발급한다(발급 전 `owner_id` 검사, 파일명=현재 파일명).         |
| POST   | `/documents/{id}/retry`                | 실패 문서 재시도: `failed`만 `processing`으로 되돌려 인제스트를 다시 enqueue한다(§8). |

- 에러: 권한 외 404, 이동 충돌은 폴더 정책 준수, upload confirm 검증 실패 4xx. 모든 쿼리 `owner_id` 강제.
- PATCH는 보낸 필드만 반영한다(`model_fields_set`). `folder_id=null`은 루트 이동이고, `display_filename`은 현재 파일명만 바꾼다(원본 파일명·AI 메타 보존, document.md §5).

## 2. 모듈 흐름

- `documents/router → service → repository`, service가 `storage`(minio_client)·`queue`(arq) 호출.
- upload init: documents 행(`uploaded`)·`object_key` 생성 → storage가 presigned PUT 발급.
- upload confirm: storage `stat_object`로 존재·크기 검증 → `processing` 전이 → 인제스트 enqueue(pipeline).
- download: `owner_id` 검사 → storage presigned GET 발급.
- delete: 진행 중 인제스트 job 선제 abort(arq) → `object_key` 수집 → DB 삭제(청크 CASCADE) → storage 오브젝트 삭제(재시도·멱등).

## 3. presigned 메커니즘

- MinIO 클라이언트 연결은 infrastructure §4, 버킷 보장은 §7. presign TTL은 짧게(5~15분).
- 업로드: presigned PUT 발급 → 브라우저가 MinIO에 직접 PUT → upload confirm이 `stat_object`로 검증.
  - `stat_object`: 오브젝트 본문을 내려받지 않고 메타데이터(존재 여부·크기·etag·content-type)만 조회하는 호출. 업로드 완료·크기 일치를 가볍게 확인한다.
- 다운로드: presigned GET 발급, 응답 `Content-Disposition`에 한국어 원본 파일명(RFC 5987). 발급 전 `owner_id` 검사.
  - `GET /documents/{id}/download?disposition=inline`: 인앱 미리보기(PDF·이미지)용. `inline` disposition + 응답 `Content-Type`(`mime_type`) 오버라이드로 브라우저가 렌더한다. 기본은 `attachment`(다운로드).

## 4. 고아 방지

- presigned PUT TTL(5~15분) 만료로 미완 업로드를 차단한다.
- 전송 도중 취소·삭제 시 클라이언트가 진행 중 업로드 PUT을 중단해, 늦은 PUT이 행 없는 오브젝트(고아)를 만드는 것을 막는다(frontend §11).
- 미완 업로드(`uploaded`) 행을 자동 삭제하는 주기 배치는 두지 않는다.

## 5. 무결성·멱등

- `sha256`은 인제스트 중 계산해 채운다. 컬럼·인덱스는 documents-schema.md §3, 중복 규칙은 document.md §4.
- 멱등: 중복 upload confirm은 그 문서가 이미 `processing`/`ready`면 추가 처리 없이 무시한다(중복 인제스트 enqueue 방지).

## 6. 설계 결정

- presigned PUT/GET로 브라우저 ↔ MinIO 직접 전송(서버 프록시 회피).
- 엔드포인트 단일화: MinIO가 단일 공인 IP로만 노출되어 서버가 만드는 호스트와 브라우저 접속 호스트가 같다. 서버용/브라우저용 URL 분리·치환 불필요.

## 7. 운영 배포 전 TODO

> presigned URL은 서명만 맞으면 통과하고 발급 후엔 앱 인증을 우회한다. 현 배포(http·공인 IP)에선 실제 위험이라 별도 관리.

- 🔴 평문 전송(http) — presigned URL·파일 본문 평문 노출, 스니핑·민감문서 탈취 가능(최대 위험)
  - 해결: [ ]
  - 비고: 운영 전 TLS 적용(MinIO 앞 https 종단/리버스 프록시) 또는 VPN·내부망 한정(infrastructure §8 연계).
- 링크 유출 = 권한 유출
  - 해결: [x]
  - 비고: TTL 5~15분 + 발급 시 `owner_id` 검사 + 로그에 URL 미기록.
- 업로드 변조 — 선언과 다른/더 큰 파일 업로드 가능
  - 해결: [x]
  - 비고: presigned PUT 서명에 `Content-Length`/`Content-Type` 조건 + upload confirm `stat_object` 검증.
- 자격증명 노출 — `.env` 유출 시 버킷 전체 접근
  - 해결: [ ]
  - 비고: 강한 키 교체, `.env`는 `.gitignore`, 앱 전용 액세스키 분리.

## 8. 실패 문서 재시도

- `POST /documents/{id}/retry`는 인제스트가 실패한 문서를 사용자 요청으로 다시 처리한다.
- 서비스는 재시도 전 네 가지 가드를 순서대로 검사하고, 막히면 `{error:{code}}` 봉투로 거부한다.
  - 상태가 `failed`가 아니면 `retry_not_failed`로 거부한다.
  - `retry_count`가 상한(`MAX_RETRIES=5`)에 도달하면 `retry_limit_exceeded`로 거부한다(독성 문서 무한 재시도 차단).
  - `error`에 영구 오류 표지("지원하지 않는 파일 형식")가 있으면 `retry_permanent_error`로 거부한다.
  - `stat_object`로 원본 객체가 없으면 `upload_not_completed`로 응답해 재업로드를 안내한다.
- 가드를 모두 통과하면 서비스는 `status=processing`, `stage=null`, `error=null`로 되돌리고 `retry_count`를 1 늘린 뒤 인제스트를 다시 enqueue한다.
- 전체 재실행은 멱등이라 처음부터(extracting) 다시 시작해도 안전하다(ingestion-backend §1).
- 같은 작업 키(`ingest:{id}`)의 arq 결과 키를 먼저 지워 1시간 재enqueue 차단을 해제한다(ingestion-backend §1).
- 실패 분류는 두 갈래이다. 일시 오류는 재시도로 복구하고, 영구 오류와 객체 없음은 재시도 대신 거부 또는 재업로드로 처리한다.
