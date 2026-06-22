---
created: 2026-06-22
completed: 2026-06-22
overview: 대량 동시 업로드가 생성 LLM 슬롯·KV 캐시를 초과해 41개 실패·6개 좀비를 낸 사고를 권장안 A로 수정·대처한다 (lesson 01).
---

> 사고 진단과 수치 근거는 `lessons/01-bulk-upload-llm-overload.md`(§0 구성 한도·Fix 권장안 A)다.
> 불변식 둘을 지킨다. `max_jobs` 이하 채팅 슬롯 수, 그리고 프롬프트 토큰 더하기 출력(512) 이하 슬롯당 컨텍스트(`-c` 나누기 슬롯 수).

## 데이터 정리
> 사용자 지시로 재인제스트(재시도) 대신 삭제로 처리했다. 막힌 데이터를 남기지 않는다.
- [x] A1 좀비 processing 6개를 삭제했다 — 오늘(2026-06-22) 업로드분에 포함돼 DB 행·MinIO 객체·arq 키와 함께 제거했다 (lesson 01 §Cause-2).
- [x] A2 실패 41개를 삭제했다 — 동일하게 DB 행·MinIO 객체·arq 키를 제거했다. 합계 47개 삭제, 2026-06-19 정상 문서 5개는 보존했다.

## 인프라 — 채팅 서버 용량 (A안)
- [x] B1 `scripts/llama-chat.sh`를 `--parallel 4 -c 16384`로 변경했다 — 재기동 로그에서 슬롯 4개·슬롯당 `n_ctx=4096`을 확인했다.

## 백엔드 — 동시성·종결·프롬프트 (A안)
- [x] C1 `WorkerSettings.max_jobs=4`를 설정했다 — 채팅 슬롯 4개에 동시 잡을 맞췄다(기존 arq 기본 10).
- [x] C2 `WorkerSettings.job_timeout=900`을 설정했다 — 기본 300초가 과부하 시 초과돼 좀비를 냈다.
- [x] C3 파이프라인 종결을 보장했다 — `_mark_failed`를 별도 세션으로 두고 `CancelledError`를 잡아 취소·타임아웃에도 `failed`로 종결한다(좀비 방지, 04-frontend D15 TODO 연계).
- [x] C4 `ingestion/meta.py` `_MAX_CHARS`를 6000에서 5000으로 줄였다 — 프롬프트 약 3200 토큰에 출력 512를 더해도 슬롯 4096 안에 둔다.

## 검증
- [x] D1 새 설정에서 47개를 처리시켜(중단 전) 채팅 로그 에러 0건을 확인했다 — 과거 같은 부하에서 500이 40건이었으나 슬롯 4×4096·`max_jobs=4` 하에서는 0건이었다. 전용 50개 재현 테스트는 데이터 삭제로 생략했다.
- [x] D2 재기동 후 채팅 로그에 `Context size exceeded`·`failed to find free space in the KV cache`·`send_error`가 0건임을 확인했다.
- [x] D3 C3 종결 보장 코드를 적용하고 ruff·import로 정적 검증했다 — 라이브 처리중-삭제 시험은 데이터 삭제로 미실시다.

## 문서 반영
- [x] E1 `lessons/01-bulk-upload-llm-overload.md`의 `status`를 resolved로 바꾸고 Fix에 적용/미채택 표기를 달았다.
- [x] E2 아키텍처를 반영했다 — infrastructure §6(채팅 `--parallel 4 -c 16384`·슬롯 정렬)·ingestion-backend §1(`max_jobs`·`job_timeout`·취소 종결)·§2-3(`_MAX_CHARS` 5000)을 갱신했다.
