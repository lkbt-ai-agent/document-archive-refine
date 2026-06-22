---
created: 2026-06-22
completed: —
overview: PDF 추출 본문의 NUL·비허용 C0 제어 문자가 청크 content 적재를 깨뜨린 사고를 추출 직후 단일 정제로 막고 실패 문서를 복구한다 (lesson 02).
---

> 진단과 정제 규칙 근거는 `lessons/02-pdf-nul-byte-chunk-insert.md`(§Cause·§Fix·C0 제어 문자 표)다.
> 핵심 규칙. 탭(`\x09`)·LF(`\x0a`)·CR(`\x0d`)은 보존하고 나머지 C0(`\x00`–`\x08`·`\x0b`·`\x0c`·`\x0e`–`\x1f`)는 제거한다.

## 백엔드 — 추출 텍스트 정제
- [ ] B1 `backend/src/ingestion/pipeline.py` `_extract` 반환 직전에 정제를 적용한다 — `re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)`로 NUL과 비허용 C0를 제거한다 (lesson 02 §Fix).
- [ ] B2 정제를 단일 지점에 둔다 — PDF·OCR·TXT·MD 네 추출 경로가 합쳐지는 `_extract` 결과에만 적용해 중복을 피한다.
- [ ] B3 정제 함수를 별도 헬퍼로 분리한다 — 재사용·테스트가 가능하게 `sanitize_text(text)` 형태로 둔다.

## 데이터 복구
- [ ] A1 같은 에러로 실패한 문서를 식별한다 — `error`에 `NUL (0x00)`를 가진 `failed` 문서를 쿼리로 찾는다.
- [ ] A2 식별한 문서를 재인제스트한다 — 정제 적용 후 다시 큐에 넣어 ready로 복구한다(원본 MinIO 객체는 보존되어 재추출 가능).

## 검증
- [ ] D1 실패 PDF를 재인제스트해 ready로 끝나는지 확인한다 — 같은 문서가 청크 적재까지 통과함을 확인한다.
- [ ] D2 정제 후 DB content에 NUL이 0건인지 확인한다 — `archive.document_chunks.content`에 `\x00` 포함 행이 없음을 쿼리로 확인한다.
- [ ] D3 정상 텍스트가 보존되는지 확인한다 — 탭·줄바꿈이 정제로 사라지지 않음을 단위 시험으로 확인한다.

## 문서 반영
- [ ] E1 아키텍처에 정제 단계를 반영한다 — `architecture/05-backend/ingestion-backend.md` §2 추출 설명에 제어 문자 정제를 명시한다.
- [ ] E2 `lessons/02-pdf-nul-byte-chunk-insert.md` `status`를 resolved로 갱신하고 `# Fix`에 적용 표기를 단다.
