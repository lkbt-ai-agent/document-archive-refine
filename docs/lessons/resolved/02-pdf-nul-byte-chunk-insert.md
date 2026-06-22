---
type: failure-pattern
area: backend
tags: [postgresql, psycopg, ingestion, pdf, extraction, control-characters]
severity: high
status: resolved
---

# Problem

- 사용자가 PDF 문서 「광주전남 기존주택 등 매입임대주택 일반매입임대주택예비입주자모집공고문」을 업로드했다.
- 인제스트가 임베딩 단계의 청크 적재에서 실패했고 문서 상태가 `failed`로 떨어졌다.
- 백엔드가 문서 `error`에 다음을 기록했다. `(psycopg.DataError) PostgreSQL text fields cannot contain NUL (0x00) bytes`.
- 같은 에러가 INSERT 문을 명시했다. `INSERT INTO archive.document_chunks (document_id, parent_doc_id, chunk_index, content, metadata, embedding) VALUES ...`.
- 메타 생성 단계는 통과했고 청크 적재 단계에서만 죽었다.

# Cause

원인은 추출 본문에 NUL 바이트가 섞였고 파이프라인이 이를 정제하지 않은 데 있다.

### 1. 직접 원인: NUL 바이트가 text 컬럼 적재를 거부당함

- 추출된 본문이 NUL 바이트(`\x00`)를 포함했다.
- `archive.document_chunks.content`는 PostgreSQL `Text` 타입이다(`backend/src/documents/models.py:100`).
- PostgreSQL의 `text`/`varchar`는 NUL(0x00)을 저장하지 못한다. NUL은 내부 문자열 종료 문자라 거부된다.
- psycopg가 행을 DB로 보내기 전에 `DataError`를 던졌다(`backend/src/ingestion/pipeline.py:130`의 `upsert_chunks` 호출).

### 2. NUL 유입 경로: PDF 추출기 산출물

- PDF 텍스트 추출기(`pypdf` `extract_text()`와 `pdfplumber`, `backend/src/ingestion/extract_pdf.py`)가 일부 PDF에서 `\x00`을 산출한다.
- 깨진 문자맵(cmap), 임베디드 폰트 인코딩 문제, 널 패딩이 흔한 출처다.
- 이 문서가 거기 해당한다(추정: 정확한 폰트 원인은 미확인).

### 3. 근본 원인: 제어 문자 정제 부재

- 인제스트 파이프라인이 추출 본문에서 NUL이나 제어 문자를 제거하지 않는다.
- `backend/src/ingestion/` 전체에 NUL 또는 C0 제어 문자 제거 코드가 없다(확인함).
- 정제 안 된 본문이 `generate_meta`, `chunk_text`, `upsert_chunks`로 그대로 흘렀다.

### 4. 단계별 통과·실패가 갈린 이유

- 메타 생성은 통과했다. LLM 호출은 HTTP JSON으로 본문을 보내고 JSON 문자열은 NUL을 `\u0000` 이스케이프로 담을 수 있어 NUL을 견딘다.
- 청킹은 통과했다. 분할이 라인과 토큰 기준이라 NUL을 거르지 않는다(`backend/src/ingestion/chunking.py`).
- 청크 적재만 실패했다. PostgreSQL text 컬럼이 NUL을 거부하는 첫 지점이기 때문이다.

# Fix

2026-06-22에 적용해 해결했다. NUL과 일부 C0 제어 문자를 추출 직후 한 곳에서 제거한다.

- (적용함) 추출 직후 본문을 정제한다. 탭(`\x09`)·LF(`\x0a`)·CR(`\x0d`)는 보존하고 나머지 C0 제어 문자(`\x00`–`\x08`, `\x0b`, `\x0c`, `\x0e`–`\x1f`)를 제거한다.
- (적용함) 정제 위치를 `backend/src/ingestion/pipeline.py`의 `_extract` 반환 직전에 두었다. PDF 본문·표 셀·OCR 결과가 모두 한 번에 정제되고 메타·청킹·적재가 깨끗한 텍스트를 받는다.
- (적용함) 정제 규칙을 `backend/src/ingestion/sanitize.py`의 `sanitize_text`로 분리했다.
  - `re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)`
- (적용함) 같은 에러로 실패한 문서 3개를 재인제스트로 복구했다. 원본 PDF 재추출 결과 NUL 18개가 정제 후 0개가 됐고(길이 53108에서 53090) 3개 모두 `ready`로 끝났다.

### C0 제어 문자

- C0 제어 문자는 유니코드 `U+0000`부터 `U+001F`까지(0번부터 31번)의 32개 코드포인트를 가리킨다.
- 이들은 화면에 보이는 글자가 아니라 장치와 통신을 제어하던 문자다. 짝인 C1 제어 문자는 `U+0080`부터 `U+009F`다.
- 이번 범인 NUL(`\x00`)도 C0에 속한다. PDF 추출기가 흘리는 잔재 대부분이 같은 부류다.
- 탭(`\x09`), LF(`\x0a`), CR(`\x0d`)도 C0지만 정상 텍스트 구조라 보존한다. 나머지는 본문에 의미가 없어 제거한다.

| 코드 | 이름 | 의미 | 처리 |
| --- | --- | --- | --- |
| `\x00` | NUL | 널, PostgreSQL text 저장 불가 | 제거 |
| `\x07` | BEL | 벨(경고음) | 제거 |
| `\x08` | BS | 백스페이스 | 제거 |
| `\x09` | HT | 탭 | 보존 |
| `\x0a` | LF | 줄바꿈 | 보존 |
| `\x0c` | FF | 폼피드(페이지 나눔) | 제거 |
| `\x0d` | CR | 캐리지 리턴 | 보존 |
| `\x1b` | ESC | 이스케이프, ANSI 코드 시작 | 제거 |

- 정제 정규식 `[\x00-\x08\x0b\x0c\x0e-\x1f]`는 위 표대로 탭과 LF와 CR을 건너뛰고 나머지 C0를 제거한다.

# Prevention

- DB에 저장하는 모든 추출 텍스트를 적재 전에 정제한다. 텍스트가 들어오는 모든 경로(PDF·OCR·TXT·MD)를 단일 지점에서 덮는다.
- 보존 대상과 제거 대상을 명시한다. 탭·LF·CR만 살리고 나머지 C0 제어 문자는 버린다.
- 외부 파서 산출물을 신뢰하지 않는다. 추출기가 제어 문자나 NUL을 흘릴 수 있다고 가정하고 입력을 검증한다.
- 다양한 PDF로 인제스트를 시험한다. 스캔본·임베디드 폰트·널 패딩 PDF를 포함해 한도를 미리 확인한다.
