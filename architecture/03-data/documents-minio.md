---
created: 2026-06-12
updated: 2026-06-12
status: draft
overview: 문서 오브젝트의 MinIO 물리 저장 정책 — object key·클라이언트·presigned 업/다운로드·정리·삭제와 운영 정책.
refs: research/04 §2
---

# 문서 MinIO 정책 (물리 데이터)

## 1. object key 설계
- `docs/{uuid}`.
- 폴더 멤버십·표시명은 PostgreSQL이 보유 → 폴더 이동/이름변경이 MinIO를 건드리지 않음.

## 2. MinIO 클라이언트
- 원격 엔드포인트
- `secure=False`(http).
- `.env` 자격증명
- 버킷 1개.
- 버킷 보장은 부트스트랩(infrastructure §8).
- presign TTL 짧게(5~15분).

## 3. presigned 업로드 (PUT)
- upload init이 짧은 TTL의 presigned PUT을 발급한다.
- 브라우저가 그 URL로 MinIO에 직접 PUT 한다.
- upload confirm 시 `stat_object`로 오브젝트 존재·크기를 검증한다.
  - `stat_object`: MinIO/S3 클라이언트가 오브젝트 본문을 내려받지 않고 메타데이터(존재 여부·크기·etag·content-type 등)만 조회하는 호출. 업로드 완료·크기 일치를 가볍게 확인하는 데 쓴다.

## 4. presigned 다운로드 (GET)
- `GET /documents/{id}/download`을 호출하면 서버가 presigned GET URL을 발급한다.
  - 응답에 `Content-Disposition`으로 한국어 원본 파일명을 실어 보낸다(RFC 5987 인코딩).
- 브라우저는 그 URL로 MinIO에서 파일을 직접 fetch 한다.
- 단, presigned GET 발급 전에 서버가 `owner_id`를 반드시 검사한다(document.md §5).

## 5. 고아 오브젝트 정리
- 고아 = upload init으로 `object_key`·presigned PUT은 발급됐으나 upload confirm이 끝나지 않아, `documents` 행이 uploaded로 방치되거나 MinIO 오브젝트가 비어 있는 경우.
- TTL 정책: presigned PUT은 5~15분 후 만료되어 그 뒤로는 업로드 자체가 불가능하다.
- 정리 잡 정책: arq 주기 잡(예: 1시간마다)이 일정 기간(예: 24시간) 넘게 uploaded 상태인 행을 골라 `stat_object`로 오브젝트 부재를 확인한 뒤 그 `documents` 행을 삭제한다.

## 6. 오브젝트 삭제
- 문서 삭제 시 `object_key`를 먼저 확보한 뒤(document.md §4 DB 삭제 후), worker가 MinIO 오브젝트를 삭제한다(실패 시 재시도, 삭제 잡 멱등).

## 7. 운영 배포 전 TODO
> presigned URL은 서명만 맞으면 통과하고 발급 후엔 앱 인증을 우회한다. 현 배포(http·공인 IP)에선 실제 위험이라 별도 관리.
- 🔴 평문 전송(http) — presigned URL·파일 본문 평문 노출, 스니핑·민감문서 탈취 가능(최대 위험)
  - 해결: [ ]
  - 비고: 운영 전 TLS 적용(MinIO 앞 https 종단/리버스 프록시) 또는 VPN·내부망 한정.
- 공인 IP 노출 — MinIO가 인터넷에서 직접 도달, 공격 표면 큼
  - 해결: [ ]
  - 비고: 방화벽 출처 IP 제한, 버킷 정책 최소권한.
- 링크 유출 = 권한 유출
  - 해결: [x]
  - 비고: TTL 5~15분 + 발급 시 `owner_id` 검사 + 로그에 URL 미기록.
- 업로드 변조 — 선언과 다른/더 큰 파일 업로드 가능
  - 해결: [x]
  - 비고: presigned PUT 서명에 `Content-Length`/`Content-Type` 조건 + upload confirm `stat_object` 검증.
- 자격증명 노출 — `.env` 유출 시 버킷 전체 접근
  - 해결: [ ]
  - 비고: 강한 키 교체, `.env`는 `.gitignore`, 앱 전용 액세스키 분리.
