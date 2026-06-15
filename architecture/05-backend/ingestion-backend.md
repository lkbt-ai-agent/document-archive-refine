---
created: 2026-06-12
updated: 2026-06-12
status: draft
overview: 인제스트 파이프라인의 백엔드 구현(arq 워커·추출/OCR/메타/청킹/임베딩)을 정의한다.
refs: research/01, research/04 §4
---

# 인제스트 백엔드 (워커)

## 1. 오케스트레이션 (arq)
- `POST /documents/{id}/complete`(upload confirm)가 arq/Redis enqueue.
- `pipeline/{worker,tasks}`가 `documents.stage`를 `extracting`, `generating_meta`, `chunking`, `embedding` 순으로 전이하며 실행하고, 완료 시 `documents.status`를 `ready`로 둔다. 실패 시 `documents.status`를 `failed`로 두고 `documents.error`에 사유를 기록한다. (단계·상태 정의는 ingestion.md §2·§3·§4.)
- 멱등 키 `(document_id, stage)`, 백오프 재시도. 페이지/스테이지 단위 멱등, 한 페이지 실패가 문서 전체 중단 안 함.
- 진행 보고: `documents.status`·`documents.stage` 갱신(프론트 폴링). 소요는 `documents.ingest_ms` 기록.

## 2. 파일 타입 감지
- magic bytes(`filetype`/`python-magic`)로 PDF/이미지/TXT/MD 라우팅(확장자 불신).

## 3. PDF 추출
- 기본 텍스트 `pypdf`(BSD) `extract_text()`. 표/복잡 레이아웃은 `pdfplumber`(MIT)로 보강(Markdown 표 직렬화). PyMuPDF는 AGPL로 제외.
- 페이지별 스캔 판별: 추출 텍스트가 거의 없고(`len(extract_text().strip()) < THRESHOLD`) 이미지가 있는(`page.images`) 페이지는 텍스트 레이어가 없는 스캔 이미지로 보고 OCR로 보낸다.
- OCR 입력 분기
  - 페이지 본문을 덮는 단일 임베디드 이미지가 있으면 `page.images`로 그 이미지를 원해상도 그대로 추출해 OCR한다.
  - 임베디드 이미지가 없거나 여러 조각으로 흩어져 페이지를 못 덮으면 `pdf2image`(Poppler)로 풀페이지를 래스터 렌더해 OCR한다.

## 4. OCR
- PaddleOCR PP-OCRv5를 기본 엔진으로 쓰고, 실패하거나 품질이 낮은 페이지는 Tesseract `kor`로 폴백한다.
- 페이지 단위로 OCR하며 각 페이지에 타임아웃과 제한된 재시도(백오프)를 건다. 한 페이지가 타임아웃·재시도 소진으로 실패해도 그 페이지만 건너뛰고 기록하며 문서 전체는 계속 진행한다(부분 실패 격리 정책은 ingestion.md §3·§4).

## 5. TXT / MD
- TXT 인코딩: `charset-normalizer`, EUC-KR→CP949 안전 디코딩(상위집합), 크래시 금지.
- MD: 헤더 인지 청킹으로 구조 보존, 평문화 금지.

## 6. 메타데이터 생성
- intrinsic: pypdf/Tika(page_count·author·날짜). NLP: 언어감지·키워드.
- LLM: `--json-schema`(GBNF, backend.md §9)로 `{title,summary,topics[],keywords[]}` — MVP 읽기 전용.

## 7. 청킹
- 본문을 재귀 분할(문단·문장·단어 순으로 내려가며 자르는 방식)로 약 512토큰 청크로 나누고, 인접 청크끼리 약 64토큰을 겹쳐(overlap) 경계에서 문맥이 끊기지 않게 한다.
- 토큰 수는 문자 수 근사가 아니라 임베딩 모델의 실제 토크나이저로 측정한다(모델이 보는 길이와 분할 기준을 일치시킴).
- 표는 원자 단위로 다룬다. 한 표는 행 중간에서 쪼개지 않고 통째로 한 청크에 담아 행·열 관계가 분할로 깨지지 않게 하며, 표가 한 청크 크기를 넘으면 표 경계에서만 분할한다.
- Contextual Retrieval(각 청크를 임베딩하기 전에 문서 내 위치를 짧게 요약한 문맥을 앞에 덧붙여 검색 정확도를 높이는 기법)은 MVP에 적용하지 않는다. 청크당 LLM 호출이 추가돼 로컬 추론 인제스트 비용이 크기 때문이며, 검색 품질이 부족하다고 측정되면 도입을 검토한다.

## 8. 임베딩 & 저장
- 각 청크를 KURE-v1 임베딩 모델로 1024차원 벡터로 변환한다. 호출은 공통 `EmbeddingClient`(backend.md §8)를 거쳐 Provider에 위임한다.
- 풀링은 `cls` 토큰 방식(`--pooling cls`)을 쓴다. KURE-v1 출력은 이미 L2 정규화되어 나오므로 애플리케이션에서 다시 정규화하지 않는다(이중 정규화하면 코사인 거리가 왜곡됨).
- 임베딩 차원(1024d)은 전 시스템에서 고정한다. HNSW 인덱스가 차원에 묶여 있어 변경하면 전량 재임베딩이 필요하다(§9, ingestion.md §5).
- 청크는 `archive.document_chunks`에 멱등 upsert로 적재한다. `UNIQUE(document_id, chunk_index)` 충돌 시 갱신(`ON CONFLICT ... DO UPDATE`)하므로 워커를 재실행해도 중복 행이 생기지 않는다(documents-schema.md).

## 9. 설계 결정
- arq + Redis 채택(BackgroundTasks 제외 — 상태추적·내구성).
- 임베딩 KURE-v1 1024d 로컬 고정(차원 lock-in, data-overview).

## 10. 운영 배포 전 TODO
- pdf2image Poppler 의존
  - 해결: [ ]
  - 비고: 배포 환경 Poppler 설치 확인.
- 복잡 레이아웃 추출 품질
  - 해결: [ ]
  - 비고: 표·다단 레이아웃 추출 품질 저하 가능, 검증 필요(§3).
- 임베딩 차원 고정
  - 해결: [ ]
  - 비고: 변경 시 전량 재임베딩 — 차원 변경 금지(§9).
