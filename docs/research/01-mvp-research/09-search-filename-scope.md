---
created: 2026-06-22
updated: —
overview: 파일명을 검색 대상에 넣을 때 기존 검색 기능에 녹일지 별도 모드로 분리할지를 타사 사례와 함께 비교한다.
---

# 09. 검색에 파일명 포함, 통합이냐 별도 모드냐

이 앱의 키워드, 의미, RAG 검색에 파일명과 제목을 포함시킬 때, 기존 기능에 녹이는 방식과 별도 검색 모드로 분리하는 방식 중 무엇이 적절한지 정리한다.

---

## 1. 결론

- 타사 대다수는 파일명과 제목을 본문 검색에 합쳐 한 검색으로 다루고, 제목에 가중치를 줘 본문보다 높게 랭크한다.
- 별도 모드는 보조 수단으로만 존재한다. 별도 모드는 본문 매칭을 배제(exclude)해야 할 때만 정당하다.
- 권장안은 세 모드 모두에서 파일명과 제목을 기본적으로 본문 검색에 합치고, 정밀 검색이 필요해지면 그때 파일명 필터를 추가하는 것이다.
- 이 앱은 본문이 `document_chunks`에, 파일명이 `documents`에 있어 동일 행 가중치 합산이 그대로 안 된다. 통합 방식은 모드별로 달라진다(§5).

## 2. 현재 검색 구조

- 세 모드 모두 본문 청크(`document_chunks.content`)만 매칭하며, 파일명과 제목은 표시용으로만 조회한다([02-search-and-rag]).

### 2.1 키워드

- PGroonga `c.content &@~ :q`로 청크 본문만 매칭한다. PGroonga 미가용 시 `to_tsvector('simple', c.content)`로 폴백한다(`backend/src/search/repository.py` `keyword`).
- `original_filename`과 `llm_title`은 SELECT 절에만 있고 WHERE 매칭 대상이 아니다.

### 2.2 의미

- 청크 임베딩에 대해 pgvector 코사인 거리만 비교한다(`repository.py` `semantic`).
- 임베딩은 본문 청크 단위로만 계산하므로 파일명과 제목은 벡터에 반영되지 않는다.

### 2.3 RAG

- 검색 결과 청크를 LLM 컨텍스트로 넣어 답을 생성한다. 검색 단계가 본문 청크만 보므로 파일명도 동일하게 빠져 있다.

## 3. 핵심 선택지

### 3.1 본문 검색에 합치기

- 한 질의가 본문과 파일명을 함께 매칭하고 점수를 하나로 병합한다.
- 제목과 파일명에 가중치를 줘 본문보다 위로 올린다.
- 장점은 단일 검색창으로 끝나는 단순한 UX이며, 알려진 항목(파일명으로 찾기)이 가중치로 위에 뜬다.
- 단점은 본문 매칭을 배제할 수 없다는 점이다. 가중치는 순위를 올릴 뿐 결과를 제거하지 못한다.

### 3.2 별도 모드로 분리하기

- 파일명 또는 제목만 검색하는 모드나 필터를 따로 둔다.
- 장점은 정밀도이며, 본문만 맞은 결과를 배제할 수 있다.
- 단점은 추가 UI 비용과 사용자 학습 부담이며, 메타데이터 일관성을 요구한다.

### 3.3 보강 차원: 필터

- 필터는 순위를 바꾸지 않고 조건 미달 항목을 제외한다.
- 이름만 매칭(known-item)을 반환하려면 필터나 스코프가 필요하다. 가중치만으로는 본문 매칭을 제거하지 못한다.

## 4. 타사 구현 사례

### 4.1 Elasticsearch, OpenSearch

- `multi_match`의 필드별 부스트(`["title^3","body"]`)가 표준 통합 방식이다. 캐럿은 해당 필드 점수에 배수를 곱한다.
- 기본 `best_fields`는 최고 단일 필드 점수를 쓴다. 제목과 본문 기여를 합산하려면 `most_fields`나 `combined_fields`(BM25F)를 쓴다. `combined_fields`는 여러 필드를 하나로 합친 것처럼 점수를 낸다.
- `copy_to`는 색인 시점에 여러 필드를 한 필드로 합치는 통합이다. 원본 필드는 따로 질의 가능하게 남는다.

### 4.2 PostgreSQL 전문 검색

- `setweight`로 컬럼별 tsvector에 라벨을 달고 `||`로 이어 하나의 tsvector를 만든다. 문서의 제목과 본문처럼 서로 다른 부분을 표시하는 권장 방식이다.
- `ts_rank` 가중치는 라벨 `{D,C,B,A}` 순서로 기본 `{0.1, 0.2, 0.4, 1.0}`이다. 제목 A가 본문 D보다 높게 랭크된다.
- 단, 이 통합은 같은 행의 컬럼을 합치는 전제다. 본문과 파일명이 다른 테이블이면 그대로 적용되지 않는다(§5.1).

### 4.3 벡터, RAG 시스템

- LlamaIndex는 메타데이터를 텍스트에 주입해 임베딩과 LLM 입력에 함께 넣는다. `MetadataMode`와 `excluded_embed_metadata_keys`로 제어하며, 기본 템플릿이 `제목: X` 형태를 청크 앞에 붙인다. 이는 검색용 임베딩을 편향시키되 LLM이 읽는 내용은 따로 둘 수 있게 한다.
- Anthropic Contextual Retrieval은 청크 앞에 맥락을 붙여 임베딩과 BM25에 모두 반영하는 통합 변형이다. 상위 20 검색 실패를 49% 줄였다고 보고한다.
- Pinecone, Weaviate, Qdrant는 메타데이터를 벡터에 녹이지 않고 페이로드 필터로 분리한다. 임베딩으로 표현하기 어려운 속성을 거를 때 쓴다.

### 4.4 Paperless-ngx

- 기본 검색은 `MultifieldParser`로 `content`, `title` 등 7개 필드를 함께 매칭한다. 맨 질의가 제목과 본문을 같이 본다.
- 필드는 `type:invoice`처럼 따로 지정도 가능하다.
- 이 앱과 관련해 중요한 점은, 원시 파일명 `original_filename`이 기본 통합 필드 7개에 없고 `original_filename:` 명시가 필요하다는 것이다. 제목은 합치되 파일명은 별도 필드로 둔다.

### 4.5 Google Drive, Dropbox, Notion

- 세 곳 모두 파일명과 본문을 하나의 랭크된 목록으로 통합하며 제목을 우대한다.
- Drive는 파일명만 찾는 `title:` 연산자를 둔다. API에서 `name`은 파일명, `fullText`는 본문과 메타의 합집합으로 구분된다.
- Dropbox는 파일명, 확장자, 본문(OCR 포함)을 한 목록으로 통합하며 파일명 전용 연산자는 없다.
- Notion은 제목과 본문을 한 목록으로 검색하고 제목을 우대하며, 별도 모드로 "Title only" 필터를 둔다.

### 4.6 정보검색, UX 가이드

- 필드 부스트가 표준 통합 패턴이다. Solr eDisMax `qf="title^5 body^1"`처럼 제목 매칭을 본문보다 높인다.
- 필터와 패싯이 별도 모드 패턴이며 기제가 다르다. 필터는 조건 미달 항목을 제외할 뿐 재랭크하지 않는다. 부스트는 결과의 관련도를 낮추지 못한다.
- 파일명 입력은 정답이 보통 하나인 known-item 질의다. 강한 제목 부스트로 그 한 건을 위로 올려 해결한다.
- 별도 모드는 본문 전용 매칭을 배제해야 하거나 큰 코퍼스에서 부스트만으로 known-item이 묻힐 때 정당하다. UX를 쪼개는 비용이 있으므로 통합이 실패할 때만 도입한다.

### 4.7 1안에서 3안 대비 타사 위치

- 전통 full-text 엔진과 소비자 문서 앱은 파일명과 제목을 어휘 검색에 합치므로 2안에 가깝다. 이들은 벡터 의미 모드가 없어 1안에 대응하는 동작이 없다.
- 어휘와 벡터를 모두 갖춘 RAG, 벡터 진영은 갈린다. 임베딩에 메타데이터를 녹이면 1안이고, 벡터 밖 별도 필드로 두면 3안 철학이다.
- 이 앱은 키워드와 의미를 모두 가지므로 순수 full-text 앱보다 RAG, 벡터 진영이 직접적 선례다. 현실적 경쟁 구도는 1안(LlamaIndex 스타일)과 3안(하이브리드 스타일)이며, 2안은 벡터 쪽을 미변경하는 보수적 시작점이다.

| 타사 | 검색 종류 | 파일명, 제목 처리 | 가까운 안 |
|---|---|---|---|
| Elasticsearch, OpenSearch (§4.1) | 어휘 | `title^3` 부스트, `copy_to` | 2안 |
| PostgreSQL FTS (§4.2) | 어휘 | weighted tsvector(제목 A, 본문 D) | 2안 |
| Paperless-ngx (§4.4) | 어휘 | 제목은 합치고, 파일명은 별도 필드 | 2안 |
| Drive, Dropbox, Notion (§4.5) | 어휘 | 이름과 본문을 단일 랭크 목록 | 2안 |
| LlamaIndex (§4.3) | 의미 | 제목을 청크에 prepend 후 임베딩 | 1안 |
| Anthropic Contextual (§4.3) | 의미, 어휘 | 맥락을 임베딩과 BM25 양쪽에 | 1안 |
| Pinecone, Weaviate, Qdrant (§4.3) | 의미 | 메타데이터를 벡터 밖 별도 필드로 | 3안 철학 |

- 3안의 업계 정식 명칭은 하이브리드 검색이다. BM25 어휘 점수와 벡터 점수를 RRF로 융합하며 Elasticsearch, OpenSearch, Weaviate, Qdrant가 지원한다. 이 한 줄은 §4 본문에서 별도로 인용 검증하지 않은 분석이다.

## 5. 이 앱 적용 방법

- 본문은 `document_chunks`, 파일명과 제목은 `documents`에 있어 모드마다 통합 방법이 다르다.

### 5.1 키워드

- 같은 행이 아니므로 단일 weighted tsvector 컬럼을 그대로 만들 수 없다.
- 방안 A: 문서 단위 검색을 따로 돌려(`documents`의 파일명, 제목 매칭) 청크 결과와 UNION 후 파일명, 제목에 점수 부스트를 줘 병합한다.
- 방안 B: 각 청크의 content 앞에 제목과 파일명을 복제해 색인한다. 단순하지만 저장과 재색인 비용이 늘고 점수가 왜곡될 수 있다.
- PGroonga는 다중 컬럼 색인이 가능하므로, 문서 측 매칭은 `documents(original_filename, llm_title)` 색인으로 처리한다.

### 5.2 의미

- 청크 임베딩 전에 제목(필요 시 파일명)을 청크 텍스트 앞에 붙여 임베딩한다. LlamaIndex `MetadataMode.EMBED` 선례를 따른다(§4.3).
- 이 방식은 기존 청크의 재임베딩을 요구한다. 임베딩 차원은 고정이므로 차원 변경은 없다([data-overview], ingestion §5).

### 5.3 RAG

- RAG 검색 단계는 의미 검색 함수(`repo.semantic`)를 그대로 호출하고 키워드
  검색은 쓰지 않는다(`service.py` `ask`).
- 따라서 5.2(청크 앞 제목 prepend 후 재임베딩)를 적용하면 RAG 검색도 파일명
  을 함께 본다.
- 5.1(키워드)은 RAG에 영향이 없다. RAG 전용 추가 작업도 없다.

## 6. 권장안

- 원칙: 파일명은 어휘 매칭에 맞고 의미 벡터에는 노이즈가 된다. `llm_title`은 본문에서 생성한 요약이라 본문 임베딩과 의미가 상당히 중복된다([01-document-processing]). 따라서 파일명은 어휘 경로로 다루는 것을 기본으로 둔다.
- 용어: 어휘 검색은 질의 단어가 문서에 그대로 있는지 매칭하고(키워드 모드), 의미 검색은 임베딩 벡터 거리로 뜻 유사도를 매칭한다(의미, RAG 모드).

### 6.1 1안, 세 모드 모두 합치기

- 방법: 키워드는 문서 매칭 UNION 후 부스트(§5.1 방안 A), 의미는 청크 앞 제목 prepend 후 재임베딩(§5.2)으로 합친다. RAG는 의미를 상속한다.
- 효과: 키워드와 의미와 RAG 모두에서 파일명과 제목으로 찾는다. 제목의 의미 매칭까지 가능하다.
- 비용: 전 청크 재임베딩이 필요하고 파일명이 의미 벡터에 노이즈가 될 수 있다.

### 6.2 2안, 키워드만 합치기

- 방법: 키워드 모드에만 §5.1 방안 A를 적용해 파일명을 본문보다 높게 가중한다. 의미와 RAG는 변경하지 않는다.
- 효과: 파일명 known-item을 가장 싸게 잡는다. 재임베딩이 없어 비용과 실패 위험이 없다.
- 보강: 키워드 결과 UI에서 제목이 질의어와 일치하면 하이라이팅한다. 표시용이라 retrieval과 무관하게 싸다.
- 한계: 의미 검색과 RAG에서는 파일명으로 문서를 찾지 못한다.

### 6.3 3안, 키워드와 의미와 RAG에 어휘로 합치기

- 성격: 2안의 어휘 UNION 방식을 세 모드 전부로 일반화한 것이다. 1안은 모드마다 통합 수단이 갈리지만(키워드는 어휘 UNION, 의미는 재임베딩), 3안은 어휘 UNION 하나로 통일한다.
- 방법: 2안에 더해, 의미 검색 결과(벡터)에 `documents` 파일명을 어휘 매칭한 문서를 UNION으로 합친다. 재임베딩은 하지 않는다. RAG는 이 UNION을 상속한다(§5.3).
- 효과: 재임베딩 없이 의미와 RAG에서도 파일명을 찾는다. 본문 뜻 매칭은 기존 의미 경로가, 파일명은 어휘 경로가 담당하고 한 결과로 병합한다.
- 한계: 파일명 경로가 어휘라 동의어나 표현 차이는 못 잡는다. 정확한 토큰일 때만 맞는다.

### 6.4 비교와 결론

| 안 | 파일명 검색 범위 | 재임베딩 | 비용 | 파일명 의미 매칭 |
|---|---|---|---|---|
| 1안 | 키워드, 의미, RAG | 필요 | 높음 | 가능 |
| 2안 | 키워드만 | 불필요 | 낮음 | 불가 |
| 3안 | 키워드, 의미, RAG | 불필요 | 중간 | 어휘만 |

- 2안을 시작점으로 한다. 파일명 known-item이 핵심 가치이고 가장 싸게 얻는다.
- 의미 검색이나 RAG에서도 파일명으로 찾아야 한다는 요구가 확인되면 3안으로 확장한다. 재임베딩이 없어 위험이 작다.
- 1안은 제목의 의미 매칭까지 필요할 때만 마지막으로 둔다. 선행으로 재임베딩 범위와 키워드 병합 점수 정규화 방식을 정한다.
- 별도 파일명 필터(§3.2)는 사용자가 known-item 정밀도를 요구할 때 추가한다. 시작점이 아니다.

## 7. 출처

- Elasticsearch multi_match: https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-multi-match-query.html
- Elasticsearch combined_fields: https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-combined-fields-query.html
- Elasticsearch copy_to: https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/copy-to
- OpenSearch multi_match: https://docs.opensearch.org/latest/query-dsl/full-text/multi-match/
- PostgreSQL textsearch controls: https://www.postgresql.org/docs/current/textsearch-controls.html
- PostgreSQL textsearch functions: https://www.postgresql.org/docs/current/functions-textsearch.html
- LlamaIndex documents and nodes: https://developers.llamaindex.ai/python/framework/module_guides/loading/documents_and_nodes/usage_documents/
- Anthropic Contextual Retrieval: https://www.anthropic.com/news/contextual-retrieval
- Pinecone metadata filtering: https://docs.pinecone.io/guides/search/filter-by-metadata
- Weaviate filtering: https://docs.weaviate.io/weaviate/concepts/filtering
- Qdrant filtering: https://qdrant.tech/documentation/search/filtering/
- Paperless-ngx 검색 사용법: https://docs.paperless-ngx.com/usage/
- Paperless-ngx 색인 소스: https://github.com/paperless-ngx/paperless-ngx/blob/main/src/documents/index.py
- Google Drive 검색: https://support.google.com/drive/answer/2375114
- Google Drive 검색어 레퍼런스: https://developers.google.com/workspace/drive/api/guides/ref-search-terms
- Dropbox 검색: https://help.dropbox.com/view-edit/search
- Notion 검색: https://www.notion.com/help/search
- Solr eDisMax: https://solr.apache.org/guide/solr/latest/query-guide/edismax-query-parser.html
- NN/g 필터와 패싯: https://www.nngroup.com/articles/filters-vs-facets/
- Broder 웹 검색 질의 분류: https://sigir.org/files/forum/F2002/broder.pdf
