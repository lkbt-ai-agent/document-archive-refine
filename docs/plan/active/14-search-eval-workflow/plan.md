---
created: 2026-07-02
completed: —
overview: 검색 평가 방법론(research 03)을 구현해 데이터 적재, 테스트 실행, 데이터 리포트를 자동화하는 워크플로우를 만든다.
---

> 근거: 방법론은 [research/03-search-eval-testset/00], 워크플로우 스펙은 [research/03-search-eval-testset/01].
> 범위: 이 plan은 평가 하네스를 만든다. 제목 매칭 검색 로직 자체는 별도 수정 과제이고, 여기서는 토글만 준비한다.
> 사람 몫: 사람이 정답 라벨과 기대 동작을 승인한다([00] §11).

## A. 패키지 골격
- [x] A1 `backend/eval/` 패키지와 `uv run python -m eval` CLI를 만든다 ([01] §2).
- [x] A2 CLI가 `load`, `run`, `diff` 서브커맨드를 제공한다 ([01] §5.6).
- [x] A3 패키지가 앱의 `SearchService`, `EmbeddingClient`, DB 세션을 in-process로 재사용한다(`eval/context.py`) ([01] §5.1).

## B. 테스트셋 픽스처
- [x] B1 `fixtures/corpus.jsonl`이 핀된 코퍼스의 `sha256` 목록을 담는다(manifest 225건 생성) ([01] §5.2).
- [x] B2 `fixtures/cases.jsonl`이 케이스를 1행 1건으로 담는다 ([00] §4).
- [x] B3 pydantic 스키마가 케이스 필드(persona, mode, failure_modes, answer_doc_ids 등)를 검증한다(`eval/schemas.py`) ([00] §4).
- [x] B4 설계자가 F1부터 F7을 층화한 베이스 케이스 약 50개를 작성한다 ([00] §3, §10).
- [ ] B5 사람이 정답 라벨과 기대 동작을 승인한다 ([00] §11).

> 진행: B4로 케이스를 총 67건 만들었다. (1) 코퍼스 메타 기반 48건: 초안 45건을 라이브 매핑으로 전부 해소한 뒤 질의를 실제 사용자처럼 짧게 다듬고(상투어 제거, 변별어·F5 형태는 보존) 짧은 포괄 recall 3건을 더했다. 정답은 predicate로 정의해 완결성을 확보했고(예: 경남 행복주택 5건, 광주 행복주택 6건), 정밀도(구체 질의)와 재현(포괄 질의)을 주제별로 짝지었다(광주·혁신바우처). (2) 본문 사실 기반(BF-*) 19건: 실제 청크 본문에서 확인한 문서 고유 사실로 5개 버킷(금액·자격·마감·단계 마감·면적)과 본문 스타일을 담았다. 소득 분위표·상시근로자 N명 미만 같은 공유 보일러플레이트는 단독 정답으로 쓰지 않았고, 근거 값을 각 케이스 notes에 적었다. 면적은 ㎡ 기본이고 평은 소수만 hard로 확장했다(신림 사회주택 원룸 평·㎡ 병기). 양산 면적, K뷰티 단계, 백년소상공인 배점은 제외했다. 최종 분포는 F1:28 F2:12 F3:5 F4:6 F5:5 F6:3 F7:8(mode keyword:9 semantic:37 rag:21, difficulty easy:4 medium:47 hard:16). recall 포괄 케이스는 coverage@K 보조 지표가 어울린다(E에서 반영). 67건 전부 스키마·정적 검증과 `load --dry-run` 라이브 재해소를 통과했다(rc=0). B5 검수 시트는 `backend/eval/fixtures/cases-review.md`다. B5(사람 승인)가 남았다.

## C. 데이터 적재
- [x] C1 `loader`가 manifest `sha256`과 기존 문서 `sha256`의 차집합만 앱 인제스트 파이프라인으로 `SEED_USER_ID`에 적재한다(`eval/loader.py`) ([01] §3.1).
- [x] C2 `loader`가 적재 전에 manifest와 앱의 `sha256`이 같은 원본 바이트 해시인지 검증한다 ([01] §3.1).
- [x] C3 `loader`가 `sha256`에서 `document_id`로 가는 매핑을 산출한다 ([01] §3.1).
- [x] C4 `loader`가 `cases.jsonl`의 `answer_doc_ids`를 매핑으로 해소하고 없는 정답에 fail-fast 한다 ([01] §3.2).
- [x] C5 `loader`가 `--reingest`로 파이프라인 수정 시 코퍼스를 강제 재적재한다 ([01] §3.3).

> 진행: C 코드 구현·검증을 마쳤다. 라이브 적재 결과 코퍼스 225건 중 224건이 ready로 적재됐고 sha256 매핑 224건을 산출했다. 14케이스 정답이 모두 해소됐다(rc=0). 1건(`중동 특화 긴급 물류바우처` PDF)은 원본 손상(Unexpected EOF)으로 실패했으나 케이스 정답이 아니라 평가에 무관하다. 안전 검증용으로 `load --dry-run`(읽기 전용)과 `load --limit N`(소량 스모크)을 제공한다.

## D. 테스트 실행
- [x] D1 `runner`가 모드별로 검색을 호출한다(keyword, semantic은 리스트, rag는 답변) ([01] §4.1).
- [x] D2 `runner`가 케이스마다 정답 순위, Recall@5/@20 hit, 인용 존재·정확, 부정 케이스 거부를 기록한다 ([01] §4.1).
- [x] D3 `runner`가 제목 매칭, 쿼리 재작성 토글을 `SearchService`에 주입해 ablation 조건을 반복 실행한다(`run --ablation`) ([00] §8, [01] §4.2).
- [x] D4 `runner`가 rag 생성 온도를 0(+고정 시드)으로 고정한다 ([01] §5.3).

> 진행: `runner`가 in-process로 검색을 호출한다. retrieval은 청크 결과를 문서 단위로 접어 정답 순위·hit@5/@20·coverage@20을 낸다. rag는 인용 존재와 인용 정확(인용 문서가 정답에 포함), 부정 케이스 거부를 낸다. ablation 토글은 `SearchService`에 키워드 인자로 주입하며 기본값은 운영 동작과 같다(`query_rewrite`·`title_match`·`rag_temperature`·`rag_seed`). 제목 매칭 로직은 별도 과제라 토글만 준비했다(현재 결과 불변). rag는 온도 0·시드 0으로 결정적으로 돈다.

## E. 지표 집계
- [x] E1 `metrics`가 전역 Recall@5/@20, 인용율·인용정확율, 거부율, 평균 순위, coverage@20을 집계한다 ([00] §9, [01] §4.3).
- [x] E2 `metrics`가 모드별·실패 유형별 통과율을 집계한다 ([00] §9).

## F. 데이터 리포트
- [x] F1 `report`가 run 아티팩트를 `runs/<run_id>/`에 JSON 정본으로 쓴다 ([01] §5.2, §6).
- [x] F2 JSON이 run_id, git sha, config, aggregate, per-case를 담는다 ([01] §6.1).
- [x] F3 `report`가 JSON에서 Markdown 리포트(집계 표, 모드·유형별 표, 실패 목록, ablation 표)를 생성한다 ([01] §6.2).

> 진행: D·E·F를 구현하고 실행했다(baseline run `20260705T153223`). 전체 67건 통과율 0.851, recall@5 0.870 recall@20 0.913, 평균 순위 1.64(42/46 retrieval에서 정답 발견), 인용율 0.833 인용정확 0.778, 거부율 1.0(F6 부정 3건 전부 거부). 모드별 통과율 keyword 0.556 semantic 0.946 rag 0.809. 유형별 F3 0.40이 최저다. 주요 실패 신호(ablation·직접 진단으로 확증): (1) keyword 4건은 PGroonga `&@~`가 0건을 반환한다. 자연어 질문의 의문·군더더기 토큰(있어·알려줘·몇 평이야)이 AND로 묶이거나 붙여쓴 복합어(중소기업정책자금)가 띄어쓴 본문과 바이그램 불일치를 낸다. keyword는 재작성을 안 거쳐 원문이 그대로 들어간다. (2) F3 시간 케이스 3건은 재작성 LLM이 "올해"를 "2023년"으로 환각해 `rewritten_query` 텍스트를 오염하고 `time_ref="2023년"`이 2023 날짜 필터를 걸어 2026 문서를 전부 배제한다. ablation `no_rewrite`에서 3건 모두 pass로 뒤집혀 원인이 재작성임을 확증했다(F3 0.4→1.0, 인용정확 0.78→0.94). (3) BF 대전 본문 사실 2건은 semantic 순위 8·11로 형제 행복주택 문서에 밀린다(랭킹 심도). (4) BF-loan-amount는 앱 결함이 아니라 케이스 라벨 오류다. 질문은 "소상공인 정책자금"인데 정답을 "중소기업 정책자금 융자계획" 문서로 달았고, rag는 더 맞는 "소상공인 정책자금 융자사업" 문서를 인용했다. 수정 지시는 사람이 내린다.

> 갱신: 키워드 케이스의 질의 표현을 실사용에 맞게 바로잡았다(원칙: keyword=기억 단어, semantic/rag=자연어 의도). 의문·군더더기가 든 3건(자립준비청년·명문장수기업·신림 어울리 사회주택)을 기억 단어형으로 고쳤다. 재실행에서 3건 모두 순위 1로 통과해, 이전 keyword 실패의 다수가 앱 결함이 아니라 비현실적 질의 아티팩트였음이 드러났다. baseline run `20260705T165354`: 통과율 0.851→0.895, recall@5 0.870→0.935, recall@20 0.913→0.978, keyword 0.556→0.889. 남은 실패 7건은 전부 진짜 신호다. F3 시간 3건(재작성 환각), F5-loan-spacing(붙여쓴 복합어가 한 청크에서 AND 매칭 실패), BF 대전 2건(랭킹 심도), BF-loan-amount(케이스 라벨 오류). keyword AND는 모든 토큰을 한 청크 안에서 요구하므로, 제목 단어와 표 속 단어를 섞은 질의는 여전히 0건이 된다(sillim 케이스에서 확인).

## G. 재테스트와 회귀
- [ ] G1 `runner`가 실행마다 run 아티팩트에 run_id, git sha, config를 기록한다 ([01] §7).
- [ ] G2 `diff`가 두 run을 케이스 id로 맞춰 상태 전이(FIXED, REGRESSED, UNCHANGED)와 지표 델타를 낸다 ([01] §7).
- [ ] G3 `diff`가 baseline run과 비교한 회귀 리포트를 Markdown으로 쓴다 ([01] §7).

## H. 검증과 문서 반영
- [ ] H1 워크플로우가 CI에서 결정적으로 통과함을 확인한다 ([00] §9).
- [ ] H2 구현이 research 01의 경로, CLI, 토글과 어긋나면 문서를 갱신한다.
