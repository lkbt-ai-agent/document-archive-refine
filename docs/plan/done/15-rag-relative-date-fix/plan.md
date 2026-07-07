---
created: 2026-07-06
completed: 2026-07-07
overview: RAG 상대 날짜 처리를 재작성 LLM에서 정규식과 코드로 옮겨 "올해" 연도 환각과 날짜 필터 오배제를 없앤다.
---

> 근거: 결함과 권장안은 [lessons/open/06-rag-rewrite-relative-date-year-hallucination]. 흐름은 search-and-rag §3, §4.
> 검증 기준선: 검색 평가 baseline run `20260705T165354`에서 F3 시간 케이스 3건이 실패한다.
> 범위 밖: 날짜 필터가 `created_at`(적재 시각) 기준이라 문서 공고일과 다를 수 있는 점은 별개 한계이며 이 plan에서 다루지 않는다.

## A. 상대 날짜 추출
- [x] A1 `dates.py`에 원문 질의에서 상대 표현을 뽑는 추출 함수를 추가한다(올해, 작년, 재작년, 지난달, 이번달, 최근 N일).
- [x] A2 추출 함수가 매칭한 표현과 그 표현을 제거한 잔여 질의를 함께 반환한다.
- [x] A3 추출 어휘를 `resolve_time`이 이미 이해하는 범위로 한정해 커버리지를 코드와 일치시킨다.

## B. 재작성 흐름 수정
- [x] B1 `_retrieve`가 LLM `time_ref` 대신 A1의 추출 결과를 `resolve_time`에 넘겨 날짜 범위를 만든다.
- [x] B2 `_retrieve`가 상대 표현을 제거한 잔여 질의를 재작성과 임베딩 입력으로 쓴다.
- [x] B3 재작성 시스템 프롬프트가 날짜와 연도 토큰을 새로 만들지 않도록 지시를 보강한다.

## C. LLM 시간 경로 제거
- [x] C1 `QueryParse`의 `time_ref` 필드와 `_PARSE_SYSTEM`의 기간 표현 추출 지시를 없애 LLM 시간 경로를 제거한다(`resolve_time`은 유지해 A의 정규식 결과만 받는다).

> 사이드 이펙트 점검: `time_ref`는 `_retrieve` 한 곳에서만 쓰이고 테스트나 다른 모듈 참조가 없다. `resolve_time`은 문자열만 받으므로 필드 제거의 영향이 없다.

## D. 검증
- [x] D1 `run`으로 F3 시간 케이스 3건이 pass로 바뀌는지 확인한다.
- [x] D2 시간 표현 없는 쌍(`-plain`)과 다른 rag 케이스가 회귀하지 않는지 확인한다.
- [x] D3 새 run을 baseline `20260705T165354`와 비교해 FIXED 3건과 REGRESSED 0건을 확인한다(diff 미구현 시 리포트를 수동 대조한다).
- [x] D4 keyword와 semantic 모드 지표가 불변인지 확인한다.

> 완료: A~D를 구현하고 검증했다. `dates.py`의 `extract_time_ref`가 기간 표현을 뽑고 `resolve_time`에 넘기며, 표현을 제거한 잔여 질의만 재작성과 임베딩에 쓴다. `QueryParse.time_ref`와 `_PARSE_SYSTEM`의 기간 추출 지시를 없앴다. 부수로 `resolve_time`의 재작년 오판(작년에 먼저 걸리던 순서)을 고쳤다. run `20260707T012550`에서 통과율 0.895에서 0.940, F3 0.4에서 1.0, rag 0.809에서 0.952, 인용율 0.833에서 1.0으로 올랐다. baseline `20260705T165354` 대비 FIXED 3건(F3 시간), REGRESSED 0건, keyword와 semantic은 불변이다. 남은 실패 4건(F5-loan-spacing, BF-loan-amount, BF 대전 2건)은 plan 16과 케이스 라벨 과제로 별개다.
