# 검색 평가 리포트 20260705T155025-2022d1a

- git sha: 2022d1a
- 생성: 2026-07-05T15:50:25.846859+00:00
- baseline config: {"query_rewrite": true, "title_match": true, "name": "baseline"}

## 집계 (baseline)

| 지표 | 값 |
| --- | --- |
| n_cases | 67 |
| n_error | 0 |
| pass_rate | 0.851 |
| recall_at_5 | 0.870 |
| recall_at_20 | 0.913 |
| mean_rank | 1.643 |
| retrieval_found | 42/46 |
| mean_coverage_at_20 | 0.906 |
| citation_rate | 0.833 |
| citation_correct_rate | 0.778 |
| rejection_rate | 1.000 |

## 모드별 통과율

| 모드 | 통과율 |
| --- | --- |
| keyword | 0.556 |
| semantic | 0.946 |
| rag | 0.809 |

## 실패 유형별 통과율

| 실패 유형 | 통과율 |
| --- | --- |
| F1 | 0.786 |
| F2 | 1.000 |
| F3 | 0.400 |
| F4 | 1.000 |
| F5 | 0.800 |
| F6 | 1.000 |
| F7 | 1.000 |

## ablation 비교

| config | pass_rate | recall@5 | recall@20 | citation | citation_ok | rejection |
| --- | --- | --- | --- | --- | --- | --- |
| baseline | 0.851 | 0.870 | 0.913 | 0.833 | 0.778 | 1.000 |
| no_rewrite | 0.895 | 0.870 | 0.913 | 1.000 | 0.944 | 1.000 |
| no_title_match | 0.851 | 0.870 | 0.913 | 0.833 | 0.778 | 1.000 |

## 실패 케이스 (10)

| id | mode | 유형 | 상태 | 순위 | 인용 | 거부 | note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F1-selfrely-001 | keyword | F1 | fail | n/a | n/a | n/a |  |
| F1-jangsu-001 | keyword | F1 | fail | n/a | n/a | n/a |  |
| F3-daejeon-time-001 | rag | F3 | fail | n/a | False | True |  |
| F3-loan-time-001 | rag | F3 | fail | n/a | False | True |  |
| F5-loan-spacing-001 | keyword | F5 | fail | n/a | n/a | n/a |  |
| F3-happy-time-001 | rag | F3 | fail | n/a | False | True |  |
| BF-loan-amount-001 | rag | F1 | fail | n/a | False | False |  |
| BF-daejeon-residency-001 | semantic | F1 | fail | 11 | n/a | n/a |  |
| BF-daejeon-area-001 | semantic | F1 | fail | 8 | n/a | n/a |  |
| BF-sillim-pyeong-001 | keyword | F1 | fail | n/a | n/a | n/a |  |
