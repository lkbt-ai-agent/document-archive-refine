---
created: 2026-06-11
updated: 2026-06-11
status: draft
overview: 원격 MinIO presigned 업/다운로드, object key 설계, 문서 레코드 수명주기.
refs: research/04 §2
---

# 문서 스토리지 (업로드/다운로드)

## 1. 기능 요구사항
- 문서 업로드/다운로드/삭제, 대용량(스캔 PDF) 직접 전송. 원격 MinIO만 사용(로컬 정의 금지).

## 2. 설계 결정
- presigned PUT/GET로 **브라우저 ↔ MinIO 직접 전송**(서버 프록시 회피).
- object key `docs/{uuid}` — 폴더 경로와 분리(폴더 MOVE/rename이 오브젝트 불변).
- 엔드포인트 단일화: 원격 공인 IP라 서버·브라우저 동일 URL.

## 3. 업로드 시퀀스
1. **Init** `POST /documents {folder_id, filename, size, mime}` → `documents` 행(status=uploaded) + `object_key=docs/{uuid}` + presigned PUT(짧은 TTL) 반환.
2. **Upload** 브라우저 → MinIO 직접 PUT.
3. **Confirm** `POST /documents/{id}/complete` → `stat_object` 검증(존재/크기) → status=processing → arq 인제스트 enqueue.

## 4. 다운로드
`GET /documents/{id}/download` → presigned GET 반환(Content-Disposition 한국어 원본명 RFC 5987) → 브라우저 직접 fetch. **발급 전 `owner_id` 검사 필수**(§8).

## 5. object key 설계
`docs/{uuid}`. 폴더 멤버십·표시명은 PG가 보유 → 폴더 이동/이름변경이 MinIO를 건드리지 않음.

## 6. MinIO 클라이언트
원격 엔드포인트, `secure=False`, `.env` 자격증명, 버킷 1개. 버킷 보장은 부트스트랩(infrastructure §8). presign TTL 짧게(5~15분).

## 7. 검증·무결성·삭제 수명주기
- Confirm 시 size/mime 확인, 인제스트 중 sha256 계산.
- 멱등: 중복 Confirm 안전(이미 processing/ready면 무시).
- 고아 오브젝트(Init 후 Upload 미완) → TTL 만료 + 주기적 정리 잡.
- 문서 삭제: ① `object_key` 확보 → ② DB 삭제(청크·계보 CASCADE) → ③ worker가 MinIO 오브젝트 삭제(실패 시 재시도, 삭제 잡 멱등).

## 8. API 계약
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/documents?folder_id=&limit=&cursor=` | 폴더 내 문서 목록(페이지네이션) |
| GET | `/documents/{id}` | 문서 상세(메타 + `status`/`stage`/`error`) |
| POST | `/documents` | Init: `uploaded` 행 + presigned PUT(§3) |
| POST | `/documents/{id}/complete` | Confirm: `stat_object` 검증 → `processing` + 인제스트 enqueue(§3) |
| PATCH | `/documents/{id}` | 이동(`{folder_id}`). 메타 사용자 편집은 MVP 제외 |
| DELETE | `/documents/{id}` | 삭제 수명주기(§7) |
| GET | `/documents/{id}/download` | presigned GET — 발급 전 `owner_id` 검사(§4) |

에러: 권한 외 404, 형제/이동 충돌은 폴더 정책 준수(folders §7), Confirm 검증 실패 4xx. 모든 쿼리 `owner_id` 강제.

## 9. 운영 배포 전 TODO
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
  - 비고: presigned PUT 서명에 `Content-Length`/`Content-Type` 조건 + Confirm `stat_object` 검증.
- 자격증명 노출 — `.env` 유출 시 버킷 전체 접근
  - 해결: [ ]
  - 비고: 강한 키 교체, `.env`는 `.gitignore`, 앱 전용 액세스키 분리.
