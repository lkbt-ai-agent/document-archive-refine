---
created: 2026-07-06
completed: —
overview: 키워드 색인에 형태소(TokenMecab)와 바이그램을 함께 두고 OR로 검색해 붙여 쓴 복합어의 매칭 실패를 없앤다.
---

> 근거: 결함과 권장안은 [lessons/open/07-keyword-pgroonga-and-filler-and-compound]. 인덱스 정의는 documents-schema, search-schema §1.
> 검증 기준선: baseline run `20260705T165354`에서 keyword `F5-loan-spacing-001`이 0건으로 실패한다.
> 위험: TokenMecab은 원격 PG 호스트에 groonga mecab 플러그인과 한국어 사전(mecab-ko-dic)을 요구한다. A가 blocking gate다.

## A. 사전 검증 (blocking)
- [ ] A1 원격 PG 호스트에 groonga-tokenizer-mecab 플러그인과 mecab-ko-dic을 설치하고 설정할 수 있는지 확인한다.
- [ ] A2 소규모 인덱스로 TokenMecab이 한국어를 형태소로 자르는지 검증한다.
- [ ] A3 형태소가 불가하면 공백 제거 정규화(NormalizerNFKC remove_blank)로 전환하고 B와 C를 그 방식으로 축소한다.

## B. 형태소 색인 추가
- [ ] B1 마이그레이션이 `document_chunks.content`에 TokenMecab 토크나이저 PGroonga 인덱스를 추가한다.
- [ ] B2 기존 바이그램 인덱스(`ix_chunks_content_pgroonga`)를 그대로 유지한다.
- [ ] B3 재색인이 인덱스 재생성만 하고 원문, 청크, 임베딩은 건드리지 않음을 확인한다(평가 `--reingest` 불필요).

## C. OR 검색
- [ ] C1 `repository.keyword`가 형태소 인덱스와 바이그램 인덱스를 OR로 질의한다.
- [ ] C2 두 결과를 문서와 청크 단위로 합치고 score로 정렬한다(두 인덱스의 score 스케일이 달라 병합 규칙을 정한다).
- [ ] C3 과다 검색이 정밀도를 떨어뜨리면 최소 매칭 수 문턱을 나중에 더한다.
- [ ] C4 PGroonga 미설치 폴백(tsvector) 경로는 그대로 둔다.

## D. 검증
- [ ] D1 `run`으로 `F5-loan-spacing-001`이 pass로 바뀌는지 확인한다.
- [ ] D2 다른 keyword 케이스가 회귀하지 않는지 확인한다(OR 과다 검색으로 인한 정밀도 저하 여부).
- [ ] D3 새 run을 baseline `20260705T165354`와 비교해 상태 전이를 본다(diff 미구현 시 리포트를 수동 대조한다).
- [ ] D4 인덱스 추가에 따른 쓰기와 저장 비용을 점검한다.
