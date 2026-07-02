---
created: 2026-07-02
completed: —
overview: 검색 평가 방법론(research 03)을 구현해 데이터 적재, 테스트 실행, 데이터 리포트를 자동화하는 워크플로우를 만든다.
---

> 근거: 방법론은 [research/03-search-eval-testset/00], 워크플로우 스펙은 [research/03-search-eval-testset/01].
> 범위: 이 plan은 평가 하네스를 만든다. 제목 매칭 검색 로직 자체는 별도 수정 과제이고, 여기서는 토글만 준비한다.
> 사람 몫: 사람이 정답 라벨과 기대 동작을 승인한다([00] §11).

## A. 패키지 골격
- [ ] A1 `backend/eval/` 패키지와 `uv run python -m eval` CLI를 만든다 ([01] §2).
- [ ] A2 CLI가 `load`, `run`, `diff` 서브커맨드를 제공한다 ([01] §5.6).
- [ ] A3 패키지가 앱의 `SearchService`, `EmbeddingClient`, DB 세션을 in-process로 재사용한다 ([01] §5.1).

## B. 테스트셋 픽스처
- [ ] B1 `fixtures/corpus.jsonl`이 핀된 코퍼스의 `sha256` 목록을 담는다 ([01] §5.2).
- [ ] B2 `fixtures/cases.jsonl`이 케이스를 1행 1건으로 담는다 ([00] §4).
- [ ] B3 pydantic 스키마가 케이스 필드(persona, mode, failure_modes, answer_doc_ids 등)를 검증한다 ([00] §4).
- [ ] B4 설계자가 F1부터 F7을 층화한 베이스 케이스 약 50개를 작성한다 ([00] §3, §10).
- [ ] B5 사람이 정답 라벨과 기대 동작을 승인한다 ([00] §11).

## C. 데이터 적재
- [ ] C1 `loader`가 manifest `sha256`과 기존 문서 `sha256`의 차집합만 앱 인제스트 파이프라인으로 `SEED_USER_ID`에 적재한다 ([01] §3.1).
- [ ] C2 `loader`가 적재 전에 manifest와 앱의 `sha256`이 같은 원본 바이트 해시인지 검증한다 ([01] §3.1).
- [ ] C3 `loader`가 `sha256`에서 `document_id`로 가는 매핑을 산출한다 ([01] §3.1).
- [ ] C4 `loader`가 `cases.jsonl`의 `answer_doc_ids`를 매핑으로 해소하고 없는 정답에 fail-fast 한다 ([01] §3.2).
- [ ] C5 `loader`가 `--reingest`로 파이프라인 수정 시 코퍼스를 강제 재적재한다 ([01] §3.3).

## D. 테스트 실행
- [ ] D1 `runner`가 모드별로 검색을 호출한다(keyword, semantic은 리스트, rag는 답변) ([01] §4.1).
- [ ] D2 `runner`가 케이스마다 정답 순위, Recall@5/@20 hit, 인용 존재, 부정 케이스 거부를 기록한다 ([01] §4.1).
- [ ] D3 `runner`가 제목 매칭, 쿼리 재작성 토글을 `SearchService`에 주입해 ablation 조건을 반복 실행한다 ([00] §8, [01] §4.2).
- [ ] D4 `runner`가 rag 생성 온도를 0으로 고정한다 ([01] §5.3).

## E. 지표 집계
- [ ] E1 `metrics`가 전역 Recall@5/@20, 인용율, 거부율, 평균 순위를 집계한다 ([00] §9, [01] §4.3).
- [ ] E2 `metrics`가 실패 유형별 통과율을 집계한다 ([00] §9).

## F. 데이터 리포트
- [ ] F1 `report`가 run 아티팩트를 `runs/<run_id>/`에 JSON 정본으로 쓴다 ([01] §5.2, §6).
- [ ] F2 JSON이 run_id, git sha, config, aggregate, per-case를 담는다 ([01] §6.1).
- [ ] F3 `report`가 JSON에서 Markdown 리포트(집계 표, 실패 목록, ablation 표)를 생성한다 ([01] §6.2).

## G. 재테스트와 회귀
- [ ] G1 `runner`가 실행마다 run 아티팩트에 run_id, git sha, config를 기록한다 ([01] §7).
- [ ] G2 `diff`가 두 run을 케이스 id로 맞춰 상태 전이(FIXED, REGRESSED, UNCHANGED)와 지표 델타를 낸다 ([01] §7).
- [ ] G3 `diff`가 baseline run과 비교한 회귀 리포트를 Markdown으로 쓴다 ([01] §7).

## H. 검증과 문서 반영
- [ ] H1 워크플로우가 CI에서 결정적으로 통과함을 확인한다 ([00] §9).
- [ ] H2 구현이 research 01의 경로, CLI, 토글과 어긋나면 문서를 갱신한다.
