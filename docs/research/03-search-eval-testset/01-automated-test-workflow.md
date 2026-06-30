---
created: 2026-06-30
updated: 2026-06-30
status: draft
overview: 검색 평가 방법론(00)을 자동으로 돌리는 테스트 워크플로우의 적재, 실행, 재테스트, 결과 양식을 구현 관점으로 정의한다.
refs: docs/research/03-search-eval-testset/00 §4, docs/research/03-search-eval-testset/00 §12, docs/architecture/05-backend/search-backend.md §1
---

# 01. 검색 평가 자동화 테스트 워크플로우

방법론(00)이 정의한 테스트셋을 자동으로 적재하고 실행하며, 수정 후 재테스트와 결과 양식을 어떻게 구현할지 정의한다.

---

## 1. 결론 요약

- 워크플로우는 적재와 실행 두 단계와 하나의 리포트 파이프라인으로 구성한다.
- 적재 단계는 핀된 sample-datas 중 아직 안 올라온 파일만 앱 인제스트 파이프라인으로 시드 사용자(`SEED_USER_ID`)에 적재한다. 이미 올라온 문서는 그대로 재사용한다.
- 적재 단계는 정답의 안정 식별자를 실행 시점의 live `document_id`로 해소한다([00] §2).
- 검색 로직 수정은 코퍼스 재적재 없이 실행만 다시 돌린다. 파이프라인 수정만 코퍼스를 강제 재적재한다.
- 리포트는 JSON을 정본으로 쌓고 Markdown을 사람용으로 생성한다. 워크플로우는 Excel과 Admin UI를 보류한다.
- 재테스트는 run 아티팩트를 비교해 케이스 상태 전이(FIXED, REGRESSED)와 지표 델타를 보인다.

---

## 2. 구성 요소

- 워크플로우는 `backend/eval/` 패키지로 둔다. 이 패키지는 앱 코드를 재사용하고 검색을 in-process로 호출한다(§5.1).

| 모듈 | 책임 |
| ---- | ---- |
| `loader` | 코퍼스와 케이스 픽스처를 적재하고 안정 식별자를 `document_id`로 해소한다. |
| `runner` | 케이스를 모드별로 실행하고 ablation 조건을 토글한다. |
| `metrics` | Recall@K, 인용 존재, 실패 유형별 통과율을 집계한다. |
| `report` | JSON 정본과 Markdown 리포트를 쓴다. |
| `diff` | 두 run을 비교해 회귀 리포트를 만든다. |
| `__main__` | CLI 진입점이다. |

---

## 3. 테스트셋 적재 워크플로우

### 3.1 코퍼스 프로비저닝

- MVP는 인증이 없어 `SEED_USER_ID`가 단일 사용자이자 평가 owner다. 따라서 `loader`는 핀된 `sample-datas`를 `SEED_USER_ID`에 둔다.
- `loader`는 이미 올라온 문서를 재사용하고, 아직 안 올라온 파일만 새로 적재한다(§3.4). 이 방식은 OCR과 임베딩 재계산을 피한다.
- `loader`는 앱의 실제 인제스트 파이프라인(MinIO 업로드와 arq 인제스트 잡)을 구동한다. 이 경로는 평가가 앱과 같은 청킹, 임베딩, 제목 처리를 거치게 해 F1과 F2를 진짜 결함으로 측정한다.
- 핀된 전체 집합은 순위와 Recall 지표를 의미 있게 만들고, F1과 F7의 distractor를 자연 발생시킨다([00] §3).
- `loader`는 `sha256`에서 `document_id`로 가는 매핑을 산출한다.

### 3.2 케이스 적재

- `loader`는 `cases.jsonl`을 읽는다([00] §4).
- `loader`는 각 케이스의 `answer_doc_ids` 안정 식별자를 매핑으로 `document_id`로 해소한다.
- `loader`는 코퍼스에 없는 정답을 만나면 즉시 멈춘다(fail-fast).

### 3.3 재테스트 시 적재

- 검색 로직만 수정하면, `loader`는 코퍼스를 재적재하지 않고 기존 매핑을 재사용한다.
- 파이프라인(청킹, 제목, 임베딩)을 수정하면, `loader`는 `--reingest`로 코퍼스를 강제 재적재하고 매핑을 다시 산출한다.
- 평가 코퍼스는 `SEED_USER_ID`의 핀된 sample-datas 집합이다. 결과 비교는 이 집합이 유지된다고 전제하므로, 워크플로우는 평가 중 무관한 문서를 추가하지 않는다.

### 3.4 차집합 적재

- `loader`는 핀된 `sample-datas`의 `sha256`을 크롤러 manifest에서 읽는다([02-test-data-crawler/00] §2.2).
- `loader`는 `SEED_USER_ID`에 이미 있는 문서의 `sha256` 집합을 조회한다.
- `loader`는 두 집합의 차집합(아직 안 올라온 파일)만 실제 파이프라인으로 `SEED_USER_ID`에 적재한다(§3.1).
- 재실행은 안전하다. 차집합 적재는 `sha256`으로 중복을 건너뛰므로, 이미 올라온 문서를 다시 넣지 않는다.
- 매핑은 manifest의 `sha256`과 앱이 저장한 `sha256`이 같은 원본 바이트 해시라고 전제한다. `loader`는 적재 전에 이 일치를 한 번 검증한다.

---

## 4. 테스트 실행 워크플로우

### 4.1 케이스 실행

- `runner`는 모드별로 검색을 호출한다. keyword와 semantic은 검색 결과 리스트를 받고, rag는 답변과 인용을 받는다(search-backend §1).
- `runner`는 케이스마다 정답 문서의 순위, Recall@5/@20 hit, rag 인용 존재, 부정 케이스 거부를 기록한다.

### 4.2 ablation 실행

- `runner`는 같은 케이스를 ablation 조건마다 반복 실행한다([00] §15).
- `runner`는 제목 매칭과 쿼리 재작성을 config 토글로 켜고 끈다.

### 4.3 집계

- `metrics`는 전역 Recall@5/@20, 인용율, 실패 유형별 통과율, 평균 순위, 거부율을 집계한다([00] §12).

### 4.4 재테스트 시 실행

- `runner`는 같은 케이스 집합을 다시 실행한다.
- `runner`는 run 아티팩트에 `run_id`, git sha, config를 기록한다.
- `diff`는 직전 run 또는 baseline run과 결과를 비교한다(§7).

---

## 5. 구현 스펙

### 5.1 위치와 호출

- 워크플로우는 `backend/eval/` 패키지에 둔다. 실행은 `uv run python -m eval`이다.
- 워크플로우는 앱의 `SearchService`, `EmbeddingClient`, DB 세션을 재사용한다.
- 워크플로우는 HTTP 대신 in-process로 검색을 호출한다. 이 선택은 결정성과 속도를 얻고 uvicorn 기동을 없앤다.

### 5.2 데이터 파일

- `backend/eval/fixtures/cases.jsonl`은 케이스를 담는다([00] §4 스키마).
- `backend/eval/fixtures/corpus.jsonl`은 핀된 코퍼스의 `sha256` 목록을 담는다.
- `backend/eval/runs/<run_id>/`는 run 아티팩트(JSON, Markdown)를 담는다.

### 5.3 결정성

- 워크플로우는 `SEED_USER_ID`에 핀 코퍼스만 두고 평가한다. 핀 목록이 코퍼스를 고정한다.
- 워크플로우는 rag 생성 온도를 0으로 둔다. 인용 존재 체크는 온도에 둔감한 견고한 이진 신호다.

### 5.4 config 토글

- `runner`는 `SearchService`에 평가용 옵션(제목 매칭, 쿼리 재작성)을 주입한다.
- 토글의 기본값은 운영 동작과 같다.

### 5.5 의존성

- 워크플로우는 새 무거운 의존을 추가하지 않는다. 워크플로우는 케이스 검증에 pydantic을 쓰고 나머지는 앱 스택을 재사용한다.

### 5.6 CLI

```bash
uv run python -m eval load                # 코퍼스와 케이스 적재(멱등)
uv run python -m eval load --reingest     # 파이프라인 수정 후 강제 재적재
uv run python -m eval run                 # 전체 케이스 실행, JSON과 Markdown 생성
uv run python -m eval diff <base> <new>   # 두 run 회귀 비교
```

---

## 6. 결과 양식

### 6.1 결정

- 워크플로우는 JSON을 정본으로 쌓고 Markdown을 JSON에서 생성한다.
- 워크플로우는 Excel과 Admin UI를 MVP에서 보류한다.

### 6.2 양식 비교

| 양식 | 용도 | 판정 | 사유 |
| ---- | ---- | ---- | ---- |
| JSON | 기계 판독, CI 소비, diff 원본 | 정본 | 결정적이고 비교 가능하다. |
| Markdown | 사람 리뷰, PR 첨부 | 생성 | JSON에서 뽑아 가독성을 준다. |
| Excel | 이해관계자 공유 | 보류 | 필요 시 JSON에서 변환한다. |
| Admin UI | 대시보드 | 보류 | MVP에는 과하다. 추후 JSON을 읽어 만든다. |

### 6.3 JSON 구조

```jsonc
{
  "run_id": "20260630T1530-ab12cd3",
  "git_sha": "ab12cd3",
  "created_at": "2026-06-30T15:30:00Z",
  "config": { "title_match": false, "query_rewrite": true },
  "aggregate": {
    "recall_at_5": 0.78, "recall_at_20": 0.90,
    "citation_rate": 0.95, "rejection_rate": 0.80, "mean_rank": 6.2,
    "by_failure_mode": { "F2": 0.40, "F3": 0.70, "F4": 0.50 }
  },
  "cases": [
    { "id": "F2-title-001", "mode": "semantic", "failure_modes": ["F2"],
      "hit_at_5": false, "hit_at_20": true, "answer_rank": 14,
      "citation": null, "status": "fail" }
  ]
}
```

### 6.4 Markdown 구조

- Markdown은 상단에 집계 지표 표를 둔다.
- Markdown은 실패 케이스 목록을 정답 순위와 함께 나열한다.
- Markdown은 ablation 케이스를 조건별 표로 보인다([00] §15.1).

---

## 7. 재테스트와 회귀 비교

- `diff`는 두 run의 JSON을 케이스 `id`로 맞춰 비교한다.
- `diff`는 케이스마다 상태 전이를 FIXED, REGRESSED, UNCHANGED로 분류한다.
- `diff`는 집계 지표의 델타를 함께 낸다.
- 워크플로우는 한 run을 baseline으로 핀한다. 수정 후 run은 baseline과 비교한다.
- `diff`는 회귀 리포트를 Markdown으로 쓴다. 이 리포트는 수정이 고친 케이스와 깨뜨린 케이스를 함께 보인다.

---

## 8. 용어

- fixture(픽스처): 픽스처는 테스트가 읽어 쓰는 고정 입력 데이터 파일이다.
- in-process 호출: in-process 호출은 HTTP 서버를 거치지 않고 같은 프로세스 안에서 함수로 직접 부르는 방식이다.
- provisioning(프로비저닝): 프로비저닝은 테스트에 필요한 데이터와 환경을 미리 채워 준비하는 단계이다.
- run artifact(run 아티팩트): run 아티팩트는 한 번의 실행이 남기는 결과 파일 묶음이다.
- regression(회귀): 회귀는 수정 때문에 멀쩡하던 동작이 다시 망가지는 것이다.
