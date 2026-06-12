---
created: 2026-06-11
updated: 2026-06-12
status: approved
overview: 문서 도메인 - 업로드/다운로드/삭제 기능·설계, MinIO 오브젝트 로직, PostgreSQL documents 로직.
refs: research/04 §2
---

# 문서 (document)

## 1. 기능 요구사항
- 문서 업로드/다운로드/삭제.
- 물리(MinIO) 오브젝트 로직은 `documents-minio.md`, documents 행 스키마는 `documents-schema.md`.
- 문서 메타데이터 추출은 `ingestion.md` 참고
- 문서 검색 및 RAG 는 `search-and-rag.md` 참고

## 2. 설계 결정
- presigned PUT/GET로 브라우저 ↔ MinIO 직접 전송
- object key `docs/{uuid}`: 폴더 경로와 분리(폴더 MOVE/rename 해도 오브젝트 불변).
- 엔드포인트 단일화
  - MinIO가 단일 공인 IP 1개로만 노출된다.
  - 백엔드가 presigned URL을 만들 때 쓰는 호스트와 브라우저가 실제 접속하는 호스트가 같다.
  - 따라서 서버용/브라우저용 URL을 따로 만들거나 호스트를 치환할 필요가 없다.

## 3. 업로드/다운로드/삭제
- 업로드
  - upload init: 사용자가 파일을 올리면 서버가 먼저 문서 레코드를 만들고 presigned PUT을 발급한다.
  - upload: 브라우저가 MinIO에 직접 파일을 올린다.
  - upload confirm: 서버가 업로드 완료를 검증하고 인제스트를 시작한다.
  - 물리 처리는 `documents-minio.md` §3.
- 다운로드
  - 서버가 소유자를 확인한 뒤 presigned GET을 발급하고 브라우저가 MinIO에서 직접 내려받는다.
  - 물리 처리는 `documents-minio.md` §4.
- 삭제
  - 문서를 지우면 DB 레코드와 청크가 삭제되고, MinIO 오브젝트는 worker가 별도로 정리한다.
  - 물리 처리는 `documents-minio.md` §6, 논리 처리는 §4.

## 4. 논리 레코드
- 업로드된 문서의 논리 정보는 PostgreSQL `documents` 행으로 추적된다.
- 각 문서는 원본 파일명·크기·등록일과 AI가 추출한 메타데이터(제목·요약·토픽·키워드)를 함께 보유하며, MVP에서는 사용자 보정 없이 읽기 전용으로 표시한다(추출 과정은 ingestion.md).
- 상태 수명주기(`documents.status`):
  - `uploaded`(업로드 대기): 레코드 생성 직후, 오브젝트 업로드를 기다리는 상태.
  - `processing`(처리중): 업로드 검증을 통과해 인제스트(추출·청킹·임베딩)가 진행 중.
  - `ready`(완료): 인제스트 완료. 실패 시 `failed`.
  - 진행 세부 단계는 `documents.stage` 컬럼에 기록된다(값은 ingestion.md).
- 업로드를 시작했지만(레코드는 만들어졌지만) 끝내지 않아 `uploaded` 상태로 남은 문서(고아)는, 일정 시간이 지나면 주기적 정리 작업이 자동으로 삭제한다. 구체 TTL·정리 잡 정책은 `documents-minio.md` §5.
- 같은 내용의 파일은 식별·표시만 하고 재업로드를 막지 않는다.
- 문서를 삭제하면 그 문서의 청크도 함께 삭제되고, 생성 산출물의 출처로 인용된 문서는 삭제가 제한될 수 있다.
- 컬럼·인덱스·중복(sha256)·멱등·삭제 연쇄 등 스키마·DB 정책의 구체 내용은 `documents-schema.md`(중복 §3·멱등 §4·삭제 연쇄 §2).

## 5. API 계약
- `/documents/{id}` 상세의 "메타"와 `status`/`stage`/`error`는 모두 `documents` 테이블(논리 데이터, §4)의 값이다.

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/documents?folder_id=&limit=&cursor=` | 폴더 내 문서 목록을 페이지네이션으로 조회한다. |
| GET | `/documents/{id}` | 문서 상세(`documents` 메타 + `status`/`stage`/`error`)를 조회한다. |
| POST | `/documents` | upload init: `uploaded` 상태 행을 생성하고 presigned PUT을 발급한다(documents-minio.md §3, §4). |
| POST | `/documents/{id}/complete` | upload confirm: `stat_object`로 검증하고 `processing`으로 전이한 뒤 인제스트를 enqueue한다(documents-minio.md §3, §4). |
| PATCH | `/documents/{id}` | 문서를 지정 폴더로 이동한다(`{folder_id}`). |
| DELETE | `/documents/{id}` | 삭제 수명주기를 실행한다(documents-minio.md §6, §4). |
| GET | `/documents/{id}/download` | presigned GET을 발급한다 — 발급 전 `owner_id`를 검사한다(documents-minio.md §4). |

에러: 권한 외 404, 형제/이동 충돌은 폴더 정책 준수(folders §7), upload confirm 검증 실패 4xx. 모든 쿼리 `owner_id` 강제.

운영 배포 전 TODO(MinIO 보안)는 `documents-minio.md` §7.
