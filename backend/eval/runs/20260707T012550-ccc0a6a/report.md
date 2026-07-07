# 검색 평가 리포트 20260707T012550-ccc0a6a

- git sha: ccc0a6a
- 생성: 2026-07-07T01:25:50.872800+00:00
- baseline config: {"query_rewrite": true, "title_match": true, "name": "baseline"}

## 집계 (baseline)

| 지표 | 값 |
| --- | --- |
| n_cases | 67 |
| n_error | 0 |
| pass_rate | 0.940 |
| recall_at_5 | 0.935 |
| recall_at_20 | 0.978 |
| mean_rank | 1.600 |
| retrieval_found | 45/46 |
| mean_coverage_at_20 | 0.971 |
| citation_rate | 1.000 |
| citation_correct_rate | 0.944 |
| rejection_rate | 1.000 |

## 모드별 통과율

| 모드 | 통과율 |
| --- | --- |
| keyword | 0.889 |
| semantic | 0.946 |
| rag | 0.952 |

## 실패 유형별 통과율

| 실패 유형 | 통과율 |
| --- | --- |
| F1 | 0.893 |
| F2 | 1.000 |
| F3 | 1.000 |
| F4 | 1.000 |
| F5 | 0.800 |
| F6 | 1.000 |
| F7 | 1.000 |

## 실패 케이스 (4)

| id | mode | 유형 | 상태 | 순위 | 인용 | 거부 | note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F5-loan-spacing-001 | keyword | F5 | fail | n/a | n/a | n/a |  |
| BF-loan-amount-001 | rag | F1 | fail | n/a | False | False |  |
| BF-daejeon-residency-001 | semantic | F1 | fail | 11 | n/a | n/a |  |
| BF-daejeon-area-001 | semantic | F1 | fail | 8 | n/a | n/a |  |
