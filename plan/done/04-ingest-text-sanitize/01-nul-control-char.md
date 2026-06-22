---
created: 2026-06-22
completed: 2026-06-22
overview: PDF 추출 본문의 NUL·비허용 C0 제어 문자가 청크 content 적재를 깨뜨린 사고를 추출 직후 단일 정제로 막고 실패 문서를 복구한다 (lesson 02).
---

> 진단과 정제 규칙 근거는 `lessons/02-pdf-nul-byte-chunk-insert.md`(§Cause·§Fix·C0 제어 문자 표)다.
> 핵심 규칙. 탭(`\x09`)·LF(`\x0a`)·CR(`\x0d`)은 보존하고 나머지 C0(`\x00`–`\x08`·`\x0b`·`\x0c`·`\x0e`–`\x1f`)는 제거한다.

## 백엔드 — 추출 텍스트 정제
- [x] B1 `backend/src/ingestion/pipeline.py` `_extract` 반환 직전에 정제를 적용했다 — `sanitize_text`로 NUL과 비허용 C0를 제거한다 (lesson 02 §Fix).
- [x] B2 정제를 단일 지점에 두었다 — PDF·OCR·TXT·MD 네 추출 경로가 합쳐지는 `_extract` 결과에만 적용해 중복을 없앴다.
- [x] B3 정제 함수를 별도 헬퍼로 분리했다 — `backend/src/ingestion/sanitize.py`의 `sanitize_text(text)`로 두어 재사용·테스트가 가능하다.

## 데이터 복구
- [x] A1 같은 에러로 실패한 문서를 식별했다 — `error`에 NUL을 가진 `failed` 문서 3개를 쿼리로 찾았다.
- [x] A2 식별한 문서를 재인제스트했다 — 워커를 새 코드로 재기동한 뒤 3개를 다시 큐에 넣어 모두 `ready`로 복구했다(원본 MinIO 객체 보존).

## 검증
- [x] D1 실패 PDF를 재인제스트해 ready로 끝남을 확인했다 — 3개가 청크 적재까지 통과했다(청크 83·95·83개).
- [x] D2 정제 후 content에 NUL이 없음을 확인했다 — 원본 재추출에서 NUL 18개가 정제 후 0개가 됐고(길이 53108에서 53090), `chr(0)` 리터럴은 쿼리에조차 못 들어가 컬럼 타입이 NUL을 원천 차단함을 확인했다.
- [x] D3 정상 텍스트 보존을 단위 시험으로 확인했다 — `backend/tests/test_sanitize.py` 5개 통과(탭·줄바꿈·CR·유니코드 보존, NUL·기타 C0 제거).

## 문서 반영
- [x] E1 아키텍처에 정제 단계를 반영했다 — `architecture/05-backend/ingestion-backend.md`에 §2-6 추출 본문 정제를 추가했다.
- [x] E2 `lessons/02-pdf-nul-byte-chunk-insert.md` `status`를 resolved로 갱신하고 `# Fix`에 적용 표기를 달았다.
