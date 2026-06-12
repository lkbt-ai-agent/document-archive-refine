---
created: 2026-06-11
updated: 2026-06-12
status: approved
overview: 문서 도메인 - 업로드/다운로드/삭제 기능·설계, MinIO 오브젝트 로직, PostgreSQL documents 로직.
refs: research/04 §2
---
FIXME: 스키마, DB CRUD 정책에 관한 언급은 documents-schema.md 로 옮기고, document.md 에는 문서 기능 및 제약사항을 자연어로만 묘사하라.

# 문서 (document)

## 1. 기능 요구사항
- 문서 업로드/다운로드/삭제.
- 업로드는 presigned 3단계
  - **upload init**: 행 생성 + presigned PUT 발급
  - **upload**: 브라우저가 MinIO로 직접 PUT
  - **upload confirm**: 검증 후 인제스트 job enqueue
- 물리(MinIO)·논리(PostgreSQL) 책임은 각각 §3·§4.
- 문서 메타데이터 추출은 ingestion.md 참고
- 문서 검색 및 RAG 는 search-and-rag.md 참고

## 2. 설계 결정
- presigned PUT/GET로 브라우저 ↔ MinIO 직접 전송
- object key `docs/{uuid}`: 폴더 경로와 분리(폴더 MOVE/rename 해도 오브젝트 불변).
- 엔드포인트 단일화
  - MinIO가 단일 공인 IP 1개로만 노출된다.
  - 백엔드가 presigned URL을 만들 때 쓰는 호스트와 브라우저가 실제 접속하는 호스트가 같다.
  - 따라서 서버용/브라우저용 URL을 따로 만들거나 호스트를 치환할 필요가 없다.

## 3. MinIO 로직 (오브젝트 / 물리 데이터)
### 3.1 object key 설계
- `docs/{uuid}`.
- 폴더 멤버십·표시명은 PostgreSQL이 보유 → 폴더 이동/이름변경이 MinIO를 건드리지 않음.
### 3.2 MinIO 클라이언트
- 원격 엔드포인트
- `secure=False`(http).
- `.env` 자격증명
- 버킷 1개.
- 버킷 보장은 부트스트랩(infrastructure §8).
- presign TTL 짧게(5~15분).
### 3.3 presigned 업로드 (PUT)
- upload init이 짧은 TTL의 presigned PUT을 발급한다.
- 브라우저가 그 URL로 MinIO에 직접 PUT 한다.
- upload confirm 시 `stat_object`로 오브젝트 존재·크기를 검증한다.
- `stat_object`: MinIO/S3 클라이언트가 오브젝트 본문을 내려받지 않고 메타데이터(존재 여부·크기·etag·content-type 등)만 조회하는 호출. 업로드 완료·크기 일치를 가볍게 확인하는 데 쓴다.
### 3.4 presigned 다운로드 (GET)
- `GET /documents/{id}/download`을 호출하면 서버가 presigned GET URL을 발급한다.
  - 응답에 `Content-Disposition`으로 한국어 원본 파일명을 실어 보낸다(RFC 5987 인코딩).
- 브라우저는 그 URL로 MinIO에서 파일을 직접 fetch 한다.
- 단, presigned GET 발급 전에 서버가 `owner_id`를 반드시 검사한다(§5).
### 3.5 고아 오브젝트 정리
- 고아 = upload init으로 `object_key`·presigned PUT은 발급됐으나 upload confirm이 끝나지 않아, `documents` 행이 uploaded로 방치되거나 MinIO 오브젝트가 비어 있는 경우.
- TTL 정책: presigned PUT은 5~15분 후 만료되어 그 뒤로는 업로드 자체가 불가능하다.
- 정리 잡 정책: arq 주기 잡(예: 1시간마다)이 일정 기간(예: 24시간) 넘게 uploaded 상태인 행을 골라 `stat_object`로 오브젝트 부재를 확인한 뒤 그 `documents` 행을 삭제한다.
### 3.6 오브젝트 삭제
- 문서 삭제 시 `object_key`를 먼저 확보한 뒤(§4.4 DB 삭제 후), worker가 MinIO 오브젝트를 삭제한다(실패 시 재시도, 삭제 잡 멱등).

## 4. PostgreSQL 로직 (documents 행 / 논리 데이터)
- 테이블 스키마(컬럼·인덱스·DDL)는 `documents-schema.md`. 여기선 documents 행의 도메인 동작만 다룬다.
### 4.1 문서 행 수명주기
- upload init: `documents` 행을 생성한다(status=uploaded) + `object_key=docs/{uuid}` 부여.
- upload confirm: status를 processing으로 전이하고 arq 인제스트를 enqueue한다.
- 인제스트 완료 시 ready로 전이한다.
### 4.2 무결성·해시
- 인제스트 중 sha256을 계산한다.
  - 이유: 파일 본문의 무결성 검증과 물리적으로 중복된 파일 업로드 감지에 쓴다.
  - `documents.sha256` + `ix_documents_sha256` 인덱스로 동일 파일을 빠르게 찾는다.
  - 단, 사용자가 같은 파일을 의도적으로 다시 올릴 수 있으므로, 이 경우에 대한 업로드를 차단하진 않는다.
### 4.3 멱등 (중복 upload confirm 처리)
- 같은 문서에 upload confirm 요청이 중복으로 도착해도, 그 문서가 이미 processing 또는 ready 상태이면 서버는 추가 처리 없이 그 요청을 무시한다.
### 4.4 문서 행 삭제
- DB에서 문서 행을 삭제하면 하위 청크는 CASCADE로 연쇄 삭제된다. (documents-schema.md §2 정책 적용)
- 생성 계보 쪽 처리는 generations-schema §2 정책 적용

## 5. API 계약
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/documents?folder_id=&limit=&cursor=` | 폴더 내 문서 목록을 페이지네이션으로 조회한다. |
| GET | `/documents/{id}` | 문서 상세(메타 + `status`/`stage`/`error`)를 조회한다. |
| POST | `/documents` | upload init: `uploaded` 상태 행을 생성하고 presigned PUT을 발급한다(§3.3·§4.1). |
| POST | `/documents/{id}/complete` | upload confirm: `stat_object`로 검증하고 `processing`으로 전이한 뒤 인제스트를 enqueue한다(§3.3·§4.1). |
| PATCH | `/documents/{id}` | 문서를 지정 폴더로 이동한다(`{folder_id}`). |
| DELETE | `/documents/{id}` | 삭제 수명주기를 실행한다(§3.6·§4.4). |
| GET | `/documents/{id}/download` | presigned GET을 발급한다 — 발급 전 `owner_id`를 검사한다(§3.4). |

에러: 권한 외 404, 형제/이동 충돌은 폴더 정책 준수(folders §7), upload confirm 검증 실패 4xx. 모든 쿼리 `owner_id` 강제.

## 6. 운영 배포 전 TODO
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
