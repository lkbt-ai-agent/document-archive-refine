# 08. 검색 & RAG — 작성 플랜

> **산출물:** `architecture/08-search-and-rag.md`
> **상태:** ⬜ Not started
> **근거 research:** `research/02` 전반
> **선행:** 07-document-processing-pipeline, 03-data-model

## 목적
키워드 검색(PGroonga) + 의미 검색(pgvector) + 하이브리드(RRF) + (선택)리랭킹 + 자연어→구조화 질의 + RAG 답변 파이프라인을 정의한다.

## 지켜야 할 제약
- PGroonga·pgvector 모두 **원격 단일 PostgreSQL**에서 동작(02 §3 확장 가용성 검증 전제).

## 작성 단계 (= 아키텍처 문서 섹션)
- [ ] S1. **개요/범위** — 2모드(키워드 / 자연어·RAG), 대표 시나리오 "작년 내 연봉".
- [ ] S2. **키워드 검색** — PGroonga TokenBigram(`&@~`), 한국어 형태소 미지원 문제·대안 비교, 인덱스 대상(`documents.content`), PGroonga 미설치 폴백 명시.
- [ ] S3. **의미 검색** — KURE-v1 쿼리 임베딩 → pgvector `<=>`(cosine), HNSW 사용.
- [ ] S4. **하이브리드 융합(RRF)** — 단일 SQL `hybrid_search()`(폴더/날짜/소유자 필터 포함), `k≈50`, 순위 기반 융합 근거(스케일 독립).
- [ ] S5. **리랭킹(선택·토글)** — bge-reranker-v2-m3(`llama-server --reranking`, `/v1/rerank`), top-50→top-5, day-1 비활성·평가 후 투입.
- [ ] S6. **자연어→구조화 질의** — GBNF `--json-schema`로 `{intent, rewritten_query, keywords[], filters{folder,date}}` 추출, **날짜 계산은 Python**(상대어→절대범위), `owner_id` 항상 강제.
- [ ] S7. **RAG 파이프라인** — 라우팅→(키워드 즉시검색 | 의미: 임베딩→hybrid→(선택)리랭크→컨텍스트 조립)→**인용 강제 생성**(`[n]↔chunk_id`)→답변+출처.
- [ ] S8. **인용·환각 억제** — 한국어 시스템 프롬프트, "문서에 없으면 모른다고", 컨텍스트 주입 순서.
- [ ] S9. **검색 평가 게이트** — Recall@5/@20 골든셋(~50쿼리), 인용 존재 체크, CI 결정성.
- [ ] S10. **API 계약** — 검색/질의 엔드포인트 요청·응답 스키마(필터·페이지·출처 포함).

## 캡처할 핵심 결정 (research)
- PGroonga TokenBigram, RRF k=50 단일 SQL, GBNF 추출+Python 날짜해석.

## 다이어그램
- [ ] RAG 질의 파이프라인 플로우.
- [ ] 하이브리드 융합(키워드·벡터→RRF) 도식.

## 제약·리스크·오픈 이슈
- [ ] **확장 의존** — 원격 DB에 pgvector/PGroonga 미가용 시 검색 핵심 불가(02 검증 선행).
- [ ] **PGroonga 인덱스 대상** — 문서 vs 청크 단위 결정(03 정합).
- [ ] **리랭커 런타임** — 추가 llama-server 포트/메모리.

## 완료 기준
- [ ] `architecture/08-*.md` 존재, S1~S10 충족.
- [ ] 하이브리드 SQL·NL 질의·인용 메커니즘이 원격 단일 DB 기준으로 기술됨.
