---
created: 2026-06-22
updated: —
overview: 타사 AI/RAG 앱이 키워드와 토픽 메타데이터를 나눠 쓰는지, 그 구분이 검색에 효과가 있는지 분석한다.
---

# 키워드 vs 토픽 메타데이터 분리의 실효성

LLM/RAG 애플리케이션이 키워드(keyword)와 토픽(topic)을 별도 메타데이터로 나눠 생성하는 관행이 일반적인지, 그 구분이 검색 품질을 높이는지 조사한다. Mechive는 현재 한 번의 LLM 호출로 `topics`와 `keywords`를 함께 생성한다([01 §metadata], `backend/src/ingestion/meta.py`).

---

## 1. 결론

- 키워드와 토픽은 NLP에서 실제로 다른 작업이다(§2).
- 그러나 주요 RAG 프레임워크는 한 문서 안에서 둘을 별도 필드로 나누지 않는다(§3).
- 검색 효과는 라벨 구분 자체가 아니라 메타데이터를 필터링·하이브리드 검색에 연결하는 활용에서 나온다(§4).
- Mechive의 토픽은 표시 전용이라 현재 검색 이득이 없다. 토픽에 기능을 부여하거나 키워드로 통합하는 편이 낫다(§5).

## 2. 키워드와 토픽은 NLP에서 다른 작업이다

- 키워드 추출은 한 문서에서 핵심 용어를 뽑는 작업이다.
- 토픽 모델링은 문서 집합에서 잠재 주제를 추론하는 작업이다.
- 즉 구분 축은 "단어 대 주제"가 아니라 "단일 문서 대 코퍼스"다.
- KeyBERT는 임베딩 기반으로 문서의 키워드를 추출한다.
- BERTopic은 문서를 군집화한 뒤 군집별 대표어를 토픽으로 뽑는다. 키워드 추출을 토픽 모델링의 부품으로 쓴다.
- 출처: [Quora: keyword extraction vs topic modeling](https://www.quora.com/What-is-the-difference-between-keyword-extraction-and-Topic-modeling-such-as-Latent-Dirichlet-Allocation), [BERTopic Representation docs](https://maartengr.github.io/BERTopic/getting_started/representation/representation.html), [Topic Modelling & BERTopic (Medium)](https://medium.com/mitb-for-all/topic-modelling-bertopic-4ec4e4bf1142).

## 3. 주요 RAG 프레임워크는 둘을 나누지 않는다

- LlamaIndex는 메타데이터 추출기로 `KeywordExtractor`, `TitleExtractor`, `SummaryExtractor`, `QuestionsAnsweredExtractor`, `EntityExtractor`를 제공한다.
- LlamaIndex에는 키워드와 구별되는 별도 `topic` 추출기가 없다. 키워드는 핵심어를, 제목·요약은 상위 맥락을 담당한다.
- Azure AI Search는 `Key Phrase Extraction` 스킬 하나로 핵심구를 뽑고, 별도 토픽 스킬을 두지 않는다.
- 즉 업계 표준은 "키워드(또는 핵심구) 1종 + 제목 + 요약"이며, 한 문서를 키워드·토픽 두 목록으로 쪼개지 않는다.
- 출처: [LlamaIndex Metadata Extraction docs](https://developers.llamaindex.ai/python/framework/module_guides/indexing/metadata_extraction/), [LlamaIndex metadata_extractors.py](https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/extractors/metadata_extractors.py), [Azure AI Search Key Phrase Extraction skill](https://learn.microsoft.com/en-us/azure/search/cognitive-search-skill-keyphrases).

## 4. 효과는 라벨 구분이 아니라 활용에서 나온다

- 메타데이터(키워드·태그)는 검색 정밀도를 높인다. 단 그 이득은 필터링과 하이브리드 검색에 연결될 때 발생한다.
- 메타데이터 필터링은 벡터 유사도 계산 전에 후보를 좁혀 속도와 정확도를 함께 올린다.
- 하이브리드 검색은 키워드(희소 벡터, 어휘 매칭)와 의미(밀집 벡터)를 결합해 관련성을 높인다. 키워드 메타데이터는 이 어휘 축에 기여한다.
- 따라서 검색 이득의 출처는 "키워드/토픽 라벨을 나눴다"가 아니라 "메타데이터를 질의 필터나 어휘 매칭에 썼다"이다.
- 표시 전용 메타데이터는 검색 품질에 기여하지 않는다.
- 출처: [Zilliz: Metadata Filtering, Hybrid Search or Agent in RAG](https://zilliz.com/blog/metadata-filtering-hybrid-search-or-agent-in-rag-applications), [Unstructured: Metadata for RAG](https://unstructured.io/insights/how-to-use-metadata-in-rag-for-better-contextual-results), [Metadata-Driven RAG for Financial QA (arXiv)](https://arxiv.org/html/2510.24402v1), [Redis: Hybrid search benefits for RAG](https://redis.io/blog/hybrid-search-benefits-rag-systems/).

## 5. Mechive 적용 시사점

- Mechive는 `topics`와 `keywords`를 한 LLM 호출로 생성한다. 둘의 구분은 필드 라벨("주요 토픽" vs "핵심 키워드")에 기댄 soft 구분이다([01 §metadata]).
- 두 목록은 내용이 상당 부분 겹치며(예: 토픽·키워드 모두 "임대주택", "입주자 모집"), 키워드만 의미 검색 해시태그로 쓰이고 토픽은 표시 전용이다([search-frontend §3a]).
- 업계 사례와 효과 근거를 종합하면, 표시 전용 토픽은 검색 이득이 없는 중복이다.
- 선택지는 둘이다.
  - 통합: 토픽을 제거하고 키워드로 단일화한다. 업계 표준(키워드 1종 + 제목 + 요약)에 부합한다.
  - 기능 부여: 토픽을 코퍼스 단위 패싯(폴더/문서 분류·필터)으로 승격해 키워드(문서 단위 어휘 매칭)와 역할을 분리한다. 이때 토픽은 코퍼스 일관성이 필요하므로 문서별 LLM 호출이 아닌 집합 수준 처리가 적합하다(§2 토픽 모델링 정의와 일치).
- 현 MVP 범위에서는 통합이 비용 대비 합리적이다. 패싯 검색을 로드맵에 둘 경우에만 토픽을 별도로 유지한다.

## 6. 출처

- [Quora: difference between keyword extraction and topic modeling](https://www.quora.com/What-is-the-difference-between-keyword-extraction-and-Topic-modeling-such-as-Latent-Dirichlet-Allocation)
- [BERTopic: Representation models](https://maartengr.github.io/BERTopic/getting_started/representation/representation.html)
- [Topic Modelling & BERTopic (Medium)](https://medium.com/mitb-for-all/topic-modelling-bertopic-4ec4e4bf1142)
- [LlamaIndex: Metadata Extraction](https://developers.llamaindex.ai/python/framework/module_guides/indexing/metadata_extraction/)
- [LlamaIndex: metadata_extractors.py (source)](https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/extractors/metadata_extractors.py)
- [Azure AI Search: Key Phrase Extraction skill](https://learn.microsoft.com/en-us/azure/search/cognitive-search-skill-keyphrases)
- [Zilliz: Metadata Filtering, Hybrid Search or Agent in RAG](https://zilliz.com/blog/metadata-filtering-hybrid-search-or-agent-in-rag-applications)
- [Unstructured: Metadata for RAG](https://unstructured.io/insights/how-to-use-metadata-in-rag-for-better-contextual-results)
- [Metadata-Driven RAG for Financial QA (arXiv 2510.24402)](https://arxiv.org/html/2510.24402v1)
- [Redis: Hybrid search benefits for RAG systems](https://redis.io/blog/hybrid-search-benefits-rag-systems/)
