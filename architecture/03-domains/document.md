---
created: 2026-06-11
updated: 2026-06-12
status: approved
overview: 문서 도메인 — 업로드/다운로드/삭제 프로세스와 documents 레코드 상태. 물리 저장은 documents-minio, 스키마는 documents-schema.
refs: research/04 §2
---

# 문서 (document)

## 1. 기능 요구사항
- 문서 업로드/다운로드/삭제.
- 물리(MinIO) 오브젝트 로직은 `documents-minio.md`, documents 행 스키마는 `documents-schema.md`.
- 문서 메타데이터 추출은 `ingestion.md`, 검색·RAG는 `search-and-rag.md` 참고.

## 2. 설계 결정
- presigned 직접 전송·object key·엔드포인트 단일화 등 물리 저장 설계는 `documents-minio.md` §8.

## 3. 업로드/다운로드/삭제
- 업로드
  - upload init: 사용자가 파일을 올리면 서버가 먼저 문서 레코드를 만들고 업로드 URL을 발급한다.
  - upload: 브라우저가 오브젝트 저장소에 직접 파일을 올린다.
  - upload confirm: 서버가 업로드 완료를 검증하고 인제스트를 시작한다.
  - 물리 처리는 `documents-minio.md` §3.
- 다운로드
  - 서버가 소유자를 확인한 뒤 다운로드 URL을 발급하고 브라우저가 직접 내려받는다.
  - 물리 처리는 `documents-minio.md` §4.
- 삭제
  - 문서를 지우면 레코드와 청크가 삭제되고, 오브젝트는 별도로 정리한다.
  - 물리 처리는 `documents-minio.md` §6, 논리 처리는 §4.

## 4. 논리 레코드
- 업로드된 문서의 논리 정보는 `documents` 행으로 추적된다.
- 각 문서는 원본 파일명·크기·등록일과 AI가 추출한 메타데이터(제목·요약·토픽·키워드)를 함께 보유하며, MVP에서는 사용자 보정 없이 읽기 전용으로 표시한다(추출 과정은 ingestion.md).
- 상태 수명주기(`documents.status`)
  - `uploaded`(업로드 대기): 레코드 생성 직후, 오브젝트 업로드를 기다리는 상태.
  - `processing`(처리중): 업로드 검증을 통과해 인제스트(추출·청킹·임베딩)가 진행 중.
  - `ready`(완료): 인제스트 완료. 실패 시 `failed`.
  - 진행 세부 단계는 `documents.stage` 컬럼에 기록된다(값은 ingestion.md).
- 업로드를 시작했지만 끝내지 않아 `uploaded`로 남은 문서(고아)는, 일정 시간 후 주기적 정리 작업이 자동 삭제한다. 구체 TTL·정리 잡 구현은 `documents-minio.md` §5.
- 같은 내용의 파일은 식별·표시만 하고 재업로드를 막지 않는다.
- 문서를 삭제하면 그 문서의 청크도 함께 삭제되고, 생성 산출물의 출처로 인용된 문서는 삭제가 제한될 수 있다.
- 컬럼·인덱스·중복·멱등·삭제 연쇄 등 스키마·DB 정책은 `documents-schema.md`.

## 5. 운영 배포 전 TODO
- MinIO 보안 TODO는 `documents-minio.md` §7.
