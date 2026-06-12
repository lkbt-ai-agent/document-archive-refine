---
created: 2026-06-12
updated: 2026-06-12
status: draft
overview: 문서 도메인의 백엔드 구현(API·presigned·정리 잡·보안)을 정의한다.
refs: research/04 §2
---

# 문서 백엔드

- 공통 구조는 `backend.md`. 도메인 동작은 `document.md`, 테이블 스키마는 `documents-schema.md`, 오브젝트 키 레이아웃은 `documents-minio.md`.

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

## 3. presigned 메커니즘
- MinIO 클라이언트 연결·버킷 보장은 infrastructure §6. presign TTL은 짧게(5~15분).
- 업로드: presigned PUT 발급 → 브라우저가 MinIO에 직접 PUT → upload confirm이 `stat_object`로 검증.
  - `stat_object`: 오브젝트 본문을 내려받지 않고 메타데이터(존재 여부·크기·etag·content-type)만 조회하는 호출. 업로드 완료·크기 일치를 가볍게 확인한다.
- 다운로드: presigned GET 발급, 응답 `Content-Disposition`에 한국어 원본 파일명(RFC 5987). 발급 전 `owner_id` 검사.

## 4. 고아 정리 (잡)
- presigned PUT TTL(5~15분) 만료로 미완 업로드를 차단한다.
- arq 주기 잡(예: 1시간마다)이 일정 기간(예: 24시간) 넘게 `uploaded`로 방치된 행을 `stat_object` 부재 확인 후 삭제한다.

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
  - 비고: 운영 전 TLS 적용(MinIO 앞 https 종단/리버스 프록시) 또는 VPN·내부망 한정(infrastructure §9 연계).
- 링크 유출 = 권한 유출
  - 해결: [x]
  - 비고: TTL 5~15분 + 발급 시 `owner_id` 검사 + 로그에 URL 미기록.
- 업로드 변조 — 선언과 다른/더 큰 파일 업로드 가능
  - 해결: [x]
  - 비고: presigned PUT 서명에 `Content-Length`/`Content-Type` 조건 + upload confirm `stat_object` 검증.
- 자격증명 노출 — `.env` 유출 시 버킷 전체 접근
  - 해결: [ ]
  - 비고: 강한 키 교체, `.env`는 `.gitignore`, 앱 전용 액세스키 분리.
