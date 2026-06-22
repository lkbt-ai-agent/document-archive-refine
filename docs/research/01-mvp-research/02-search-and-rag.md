---
created: 2026-06-09
updated: 2026-06-16
overview: 키워드, 의미, 하이브리드 검색과 RAG 질의 파이프라인 설계를 정리한다.
---

# 02. 검색 & RAG

requirement TODO 해소: 키워드 검색 / 자연어 검색 설계 / AI와 임베딩 활용 방식.

대표 시나리오: `"작년 내 연봉이 얼마였지?"`. 작년 연봉계약서 문서를 찾아 그 내용으로 답변.

> 큰 그림 (처음 읽는 분께)
>
> 이 앱의 검색은 두 가지 모드로 나뉜다.
>
> - 키워드 검색: 입력한 단어가 그대로 들어간 문서를 찾는다(정확한 이름과 숫자에 강함).
> - 자연어 검색 / RAG: 질문의 의미로 관련 문서 조각을 찾고, 그 내용을 근거로 AI가 답을 만든다(표현이 달라도 잡음).
>
> 위 대표 시나리오 `"작년 내 연봉이 얼마였지?"`가 바로 이 두 번째 모드가 풀어야 할 동기 사례다. "작년"(날짜 필터), "내"(내 문서만), "연봉"(키워드+의미)을 모두 처리해야 정답인 연봉계약서를 찾아 금액을 답할 수 있다.

---

## 1. 키워드 검색: PGroonga (TokenBigram)

> 이 절은 키워드 검색(전문검색/Full-Text Search)을 한국어에서 제대로 동작시키는 방법을 다룬다.

### 문제

- PostgreSQL 기본 `tsvector`/`tsquery`는 언어별 사전 형태소 분석(한국어 문장을 의미 단위로 쪼개는 것: "연봉이"는 "연봉"+"이")을 쓴다.
- 그런데 한국어 사전이 없다(유럽어 약 15종만).
- 한국어는 조사와 어미가 어간에 붙어 "연봉/연봉이/연봉은/연봉을"이 다른 토큰으로 잡혀 정확 매칭이 조용히 실패한다.
- `pg_trgm`은 비ASCII 기본 비활성이라 한국어 부적합.

### 비교

| 옵션                       | 한국어 토큰화         | 품질                  | 속도                     | 설치비용         | 판정                |
| -------------------------- | --------------------- | --------------------- | ------------------------ | ---------------- | ------------------- |
| tsvector(`simple`)+GIN     | 공백분리(조사 미처리) | 나쁨                  | 빠름                     | 내장             | 사전 정규화 시에만  |
| pg_trgm                    | 비ASCII 기본 비활성   | 불가                  | 빠름                     | 내장             | 제외                |
| pg_bigm                    | 고정 2-gram           | 재현율↑ 랭킹 없음     | 느림(PGroonga의 약 50배) | 확장             | 차선                |
| PGroonga TokenBigram(기본) | N-gram(bigram)        | 재현율 양호, 부분매칭 | 빠름(49–65ms)            | 확장+Groonga     | 권장                |
| PGroonga TokenMecab(선택)  | 형태소(MeCab)         | 정밀↑                 | 빠름                     | MeCab+한국어사전 | 정밀 필요 시 후순위 |

> 용어:
>
> - N-gram / Bigram: 텍스트를 n글자씩 잘라 색인하는 기법(Bigram=2글자씩, "연봉"은 "연봉","봉이" 등). 사전 없이 한국어 부분 일치를 가능케 함.
> - PGroonga: PostgreSQL에 고품질 한국어 전문 검색을 더해주는 확장.

### 결정: PGroonga 기본 TokenBigram

- 사전 설치나 텍스트 정규화 없이 한국어 키워드 검색이 바로 동작하는 유일한 옵션.
- MeCab 사전 설치 리스크 회피(2주 MVP에 적합). 정밀 불만 시 추후 TokenMecab.
- pgvector와 같은 DB에서 공존(검색 모드 공유).
- 키워드 검색 대상은 청크 본문(`document_chunks.content`), 청크 단위(architecture 확정).
- 소유자 필터는 상위 문서를 경유해 건다(`document_chunks.document_id`가 가리키는 `documents`의 `owner_id`).

```sql
-- 한국어 키워드 검색: "연봉"이 들어간 청크를 bigram으로 찾아 점수순 정렬, 소유자는 상위 문서 경유
CREATE EXTENSION IF NOT EXISTS pgroonga;
CREATE INDEX idx_chunks_pgroonga ON document_chunks USING pgroonga (content);
-- "연봉" 이 연봉이/연봉은/연봉을 매칭(bigram)
SELECT c.document_id, c.id AS chunk_id, pgroonga_score(c.tableoid, c.ctid) AS score
FROM document_chunks c
WHERE c.content &@~ '연봉'
  AND c.document_id IN (SELECT id FROM documents WHERE owner_id = :u)
ORDER BY score DESC LIMIT 20;
```

> PGroonga 미설치 시 폴백: `to_tsvector('simple', c.content)`+GIN + 앱단 소문자/bigram 확장. 한국어 품질은 확연히 낮음. pg_trgm 의존 금지.

---

## 2. 의미 검색 (하이브리드 융합과 RRF는 MVP 미채택)

> - 의미 검색: 질문을 임베딩해 벡터가 가까운 청크를 찾기.
> - 임베딩: 텍스트 의미를 숫자 목록(벡터)으로 변환.
> - 하이브리드 검색: 키워드+의미 합치기.

### 결정 (architecture 확정)

- MVP는 키워드/의미를 사용자가 고르는 별도 모드로 둔다(`mode∈{keyword,semantic}`, 기본 semantic). 키워드 검색 자체는 §1대로 유지.
- RAG 검색 단계는 의미 검색 단독을 쓴다(청크 코사인 유사도 top-k).
- 하이브리드 융합과 RRF는 MVP 미채택. 아래 비교와 SQL은 채택 안 한 설계로 기록만 한다.
- 의미 검색 SQL은 §2의 hybrid_search 대신 search-schema §2의 단일 벡터 쿼리(`embedding <=> :q_vec`).

### 왜 하이브리드인가 (검토 배경, MVP 미채택)

- `pgroonga_score`/`ts_rank`는 문서 단위 점수라 희귀어 변별 불가(전역 IDF 없음. IDF=흔한 단어는 덜, 희귀 단어는 더 중요하게 치는 가중치).
- 진짜 BM25(키워드 검색 랭킹 표준 알고리즘)는 TF 포화+IDF+길이정규화.
- 벡터 검색은 의미/패러프레이즈는 잡지만 정확 토큰(이름, 숫자, "연봉")을 놓침.
- 따라서 둘을 합치는 게 표준.

### 융합: RRF (MVP 미채택, architecture 확정)

- BM25 점수와 cosine(코사인) 점수는 스케일이 달라 더할 수 없다.
- RRF(점수 체계가 다른 두 검색 결과를 순위만으로 합치는 표준 기법)는 점수가 아닌 순위를 융합해 스케일 독립.
- `score = Σ 1/(k + rank_i)`, `k≈50`(Supabase/jkatz 관행).
- 보고된 효과: 순수 벡터 약 62%, +FTS+RRF 약 84% precision.

| 방식              | 장점                           | 단점              | 판정 |
| ----------------- | ------------------------------ | ----------------- | ---- |
| RRF(균일)         | 스케일 free, 튜닝 불필요, 견고 | 점수 크기 무시    | 기본 |
| 가중 RRF          | 숫자/이름 쿼리에 lexical 가중  | 노브 추가         | 선택 |
| 가중 raw-score 합 | 크기 활용                      | 취약(스케일 상이) | 회피 |

### 단일 SQL `hybrid_search()` (MVP 미채택, architecture 확정)

> 아래는 채택하지 않은 융합 설계의 참고 구현이다. MVP 의미 검색은 search-schema §2의 단일 벡터 쿼리를 쓴다.

```sql
-- 키워드 결과(kw)와 벡터 결과(vec)를 각각 순위 매겨 RRF로 합치는 쿼리 (폴더/날짜로 먼저 필터링)
CREATE OR REPLACE FUNCTION hybrid_search(
  q_text text, q_vec vector(1024),
  k_rrf int DEFAULT 50, n int DEFAULT 20,
  f_owner uuid DEFAULT NULL, f_folder uuid DEFAULT NULL,
  f_from date DEFAULT NULL, f_to date DEFAULT NULL
) RETURNS TABLE(document_id uuid, score float) AS $$
  WITH kw AS (
    SELECT d.id, row_number() OVER (ORDER BY pgroonga_score(d.tableoid, d.ctid) DESC) AS rnk
    FROM documents d
    WHERE d.content &@~ q_text
      AND (f_owner  IS NULL OR d.owner_id = f_owner)
      AND (f_folder IS NULL OR d.folder_id = f_folder)
      AND (f_from   IS NULL OR d.doc_created_at >= f_from)
      AND (f_to     IS NULL OR d.doc_created_at <= f_to)
    LIMIT 50
  ),
  vec AS (
    SELECT c.document_id AS id,
           row_number() OVER (ORDER BY c.embedding <=> q_vec) AS rnk
    FROM document_chunks c JOIN documents d ON d.id = c.document_id
    WHERE (f_owner  IS NULL OR d.owner_id = f_owner)
      AND (f_folder IS NULL OR d.folder_id = f_folder)
      AND (f_from   IS NULL OR d.doc_created_at >= f_from)
      AND (f_to     IS NULL OR d.doc_created_at <= f_to)
    ORDER BY c.embedding <=> q_vec LIMIT 50
  )
  SELECT COALESCE(kw.id, vec.id) AS document_id,
         COALESCE(1.0/(k_rrf+kw.rnk),0) + COALESCE(1.0/(k_rrf+vec.rnk),0) AS score
  FROM kw FULL OUTER JOIN vec ON kw.id = vec.id
  ORDER BY score DESC LIMIT n;
$$ LANGUAGE sql STABLE;
```

> `<=>`는 pgvector의 cosine 거리 연산자(코사인 거리=두 벡터가 같은 방향일수록 작아짐, 작을수록 가까움)라 `ORDER BY ... ASC`가 정확. 실제 운영에서는 이 벡터 비교를 빠르게 하려고 HNSW 인덱스를 건다.

### MVP 채택 의미 검색 SQL (단일 벡터 쿼리)

- 융합 없이 청크 코사인 거리만 정렬. 소유자 필터는 상위 문서 경유.

```sql
-- 질문 임베딩 :q_vec로 청크 코사인 거리 정렬, 소유자는 상위 문서 경유
SELECT document_id, id AS chunk_id, embedding <=> :q_vec AS distance
FROM document_chunks
WHERE document_id IN (SELECT id FROM documents WHERE owner_id = :u)
ORDER BY embedding <=> :q_vec ASC
LIMIT 50;
```

> HNSW 인덱스(`vector_cosine_ops`) 사용. 폴더/날짜 필터는 위 서브쿼리에 조건을 더해 적용.

---

## 3. 리랭킹 (MVP 제외)

> 리랭킹/리랭커 = 1차로 찾은 후보를 더 정밀한 모델로 다시 채점해 상위 몇 개만 남기는 단계.

- 교차 인코더는 (쿼리,문서) 쌍을 한 모델에 함께 넣어 관련도를 점수화하는 방식이라 정확하지만 느려서 전수 스캔 불가.
- 패턴: 1차 하이브리드 top-50을 리랭크해 top-5만 남김.
- llama.cpp 네이티브 지원: `llama-server --reranking`(=`--embedding --pooling rank`)으로 Jina 호환 `/v1/rerank` 제공. 기존 런타임 재사용.

| 리랭커                          | 한국어         | GGUF/llama.cpp             | 비고                                  |
| ------------------------------- | -------------- | -------------------------- | ------------------------------------- |
| bge-reranker-v2-m3(0.6B)        | 다국어(한국어) | `--reranking` 정상         | 기본                                  |
| dragonkue/bge-reranker-v2-m3-ko | 한국어 튜닝    | 동일 아키텍처              | 한국어 금융 top-1 F1 0.9123 vs 0.8772 |
| Qwen3-Reranker-0.6B             | 다국어         | GGUF 버그(near-zero score) | 변환 수정 전 제외                     |

판정:

- MVP 제외(architecture 확정). 핵심 경로에서 구현하지 않는다.
- 추후 Recall@k 평가(§6)에서 "정답이 top-50엔 들지만 top-5엔 없음"으로 나오면 그때 bge-reranker-v2-m3(Q4_K_M) 도입을 검토한다.
- 도입 시 한국어 정밀이 중요하고 GPU 여유가 있으면 dragonkue-ko.

```python
# 후보 문서들을 리랭커 서버에 보내 쿼리와의 관련도로 다시 정렬, 상위 top_n개만 받음
def rerank(query, docs, top_n=5, url="http://127.0.0.1:8082/v1/rerank"):
    r = requests.post(url, json={"query": query, "documents": docs, "top_n": top_n})
    return r.json()["results"]   # [{index, relevance_score}] 정렬됨
```

---

## 4. RAG 질의 파이프라인: "Advanced-lite"

> RAG(Retrieval-Augmented Generation) = 관련 문서를 먼저 검색해서 그 내용을 LLM에게 근거로 주고 답하게 하는 방식. 아래 파이프라인이 그 검색에서 답변까지의 구체적 단계다.

| 기법                         | MVP 판정       | 이유                         |
| ---------------------------- | -------------- | ---------------------------- |
| 쿼리 라우팅(키워드/의미/RAG) | 채택           | UI 2모드와 동일 로직 재사용  |
| 메타데이터 필터(폴더/날짜)   | 채택(최고 ROI) | "작년" 류 구현의 핵심        |
| 라이트 쿼리 재작성/확장      | 채택(경량)     | 조사 제거, "내/작년" 해소    |
| 하이브리드+RRF               | 미채택         | §2. RAG는 의미검색 단독      |
| 리랭킹                       | MVP 제외       | §3                           |
| HyDE                         | 제외           | 쿼리당 +1 전체 생성, 지연 큼 |
| 쿼리 분해(멀티홉)            | 제외           | 아카이브 QA는 대부분 단일홉  |

### MVP 파이프라인

흐름 한눈에:

1. 쿼리의 의도를 파악(GBNF=출력 형식을 강제하는 문법).
2. 키워드면 바로 검색.
3. 의미/RAG면 임베딩+의미 검색 후 근거를 인용하며 답변 생성(하이브리드/RRF는 미채택, 리랭크는 MVP 제외).

상세 단계:

1. 라우팅+추출 (로컬 LLM 1콜, GBNF JSON): `{ intent, rewritten_query, keywords[], filters{folder?,date_from?,date_to?} }`
2. intent=keyword:
   - PGroonga `&@~`(청크 본문) + 필터로 결과(LLM 생성 없음).
3. intent=semantic/rag:
   - `embed(rewritten_query)`[KURE-v1]
   - 의미 검색(청크 코사인, top-30, 폴더/날짜 필터). 하이브리드/RRF 미채택(§2)
   - 리랭크는 MVP 제외(§3)
   - 컨텍스트 조립(청크본문 + {제목,날짜,폴더,chunk_id})
   - 인용 강제 생성으로 답변 + 출처 리스트

### 인용과 환각 억제 (한국어 시스템 프롬프트)

> - 인용/grounding = 답변 문장마다 근거가 된 청크 번호를 붙여 출처를 확인 가능케 하는 것.
> - 목적은 환각(LLM이 사실 아닌 내용을 그럴듯하게 지어내는 현상) 억제.

- "제공된 문서에만 근거해 답하라. 문서에 없으면 '제공된 문서에서 찾을 수 없습니다'라고 답하라."
- 각 청크를 `[1] [2] …` 번호로 주고 문장마다 `[n]` 인용 강제.
- `[n]`과 `chunk_id` 매핑 저장으로 UI 클릭 시 원문 딥링크(연봉 시나리오에서 숫자 신뢰에 필수).
- 컨텍스트 주입 순서: 시스템 규칙, 검색 컨텍스트(ID와 파일명), 질문(마지막).
- A.X/EXAONE은 시스템 프롬프트를 잘 따르므로 한국어로 작성.

---

## 5. 자연어 질의를 구조화 쿼리로 ("작년 내 연봉" 처리)

- 순수 의미검색으론 "작년"을 신뢰성 있게 못 건다.
- 따라서 구조화 메타 추출 + SQL 필터(LLM function-calling 패턴).

GBNF/`--json-schema` 제약 디코딩(LLM이 반드시 정해진 형식=유효한 JSON으로만 출력하게 강제하는 기법)으로 소형 로컬 LLM도 유효 JSON 강제:

```jsonc
// LLM이 "작년 내 연봉" 같은 자연어 질문에서 뽑아낼 구조화 필드(의도, 재작성쿼리, 기간 등)

{ "intent":"keyword|semantic|rag",
  "rewritten_query": str,        // "내 연봉" → "연봉 급여 계약"
  "subject": str|null,
  "time_ref": "this_year|last_year|last_month|none|absolute",
  "abs_from": "YYYY-MM-DD"|null, "abs_to": "YYYY-MM-DD"|null,
  "folder": str|null }
```

날짜 계산은 코드에서(LLM은 날짜 산술에 약함). LLM은 상대 토큰만, Python이 `now()=2026-06-09` 기준 해석:

```python
# LLM이 준 상대 시간어("last_year" 등)를 코드가 실제 날짜 범위로 변환
def resolve_range(time_ref, today=date(2026,6,9)):
    if time_ref=="last_year": return date(today.year-1,1,1), date(today.year-1,12,31)
    if time_ref=="this_year": return date(today.year,1,1), today
    return None, None
# "작년" → (2025-01-01, 2025-12-31)
```

흐름:

1. 의미 검색(`q_vec=embed("연봉 급여 계약")`, 폴더/날짜 필터 `f_from=2025-01-01, f_to=2025-12-31`, 소유자 강제). 하이브리드/RRF 미채택(§2).
2. 근로계약서 발견
3. "작년 연봉은 ₩XX,XXX,XXX원입니다 [1]".

추가 규칙:

- "내"(my)는 사용자 스코프. 추출과 무관하게 `WHERE owner_id = :current_user` 항상 강제(정확성+보안).
- 선택: 흔한 한국어 시간어("작년/올해/지난달/지난주") 정규식 사전패스로 빠른 경로 + LLM 검증.

---

## 6. 경량 검색 평가 (MVP 의사결정 게이트)

- Recall@k (Hit Rate@k): 골든(=사람이 미리 정해둔 정답) doc가 검색 상위 k개 안에 드는 비율. 값이 높을수록 "정답을 잘 끌어온다"는 뜻이며, 골든 답변 불필요, (쿼리, 정답 doc_id) 쌍만 있으면 됨.
- 레시피:
  1. 실제 아카이브에서 약 50개 한국어 쿼리 골든셋(연봉 시나리오, 시간/엔티티 쿼리 포함) 작성.
  2. Recall@5/@20을 키워드, 의미(벡터only)별 측정. 하이브리드/+리랭크 변형은 MVP 미측정(추후 도입 검토 시 비교 항목으로 추가).
  3. 각 모드 가치 판정.
- CI에서 돌 만큼 싸고 결정적. Ragas(faithfulness 등)는 MVP 이후.
- 답변 품질 경량 체크: 답변이 검색된 청크를 인용하는가(이진, LLM judge 불필요).

---

## 7. 검색 권고 요약

| 결정             | 선택                                                                        |
| ---------------- | --------------------------------------------------------------------------- |
| 키워드           | PGroonga TokenBigram                                                        |
| 임베딩           | KURE-v1(1024) pgvector HNSW cosine                                          |
| 검색             | 키워드/의미 별도 모드, RAG 의미검색 단독. 하이브리드/RRF 미채택            |
| 리랭커           | MVP 제외(추후 Recall 평가서 도입 검토). 후보 bge-reranker-v2-m3            |
| 파이프라인       | Advanced-lite: 라우팅+메타필터+라이트재작성+의미검색+인용. 하이브리드/RRF, HyDE/분해 제외 |
| 자연어 질의 변환 | GBNF 추출, Python 날짜해석, SQL 폴더/날짜 필터                              |
| 평가             | 약 50 골든쌍, Recall@5/@20 + 인용존재 체크                                  |
