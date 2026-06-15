# 용어집

## A. Writing a glossary

- Write for web developers who are new to AI and RAG.
- Keep prose terse. One idea per bullet.
- Use bullets or `###` for subtopics. Do not use "—" and "·".
- Express flows as lists, not `→` chains.

## B. AI/LLM 기본

### LLM (Large Language Model, 대규모 언어 모델)

방대한 텍스트로 학습해 "다음에 올 단어"를 예측하도록 만든 AI 모델. ChatGPT의 두뇌 같은 것.

- 질문에 답하고, 요약하고, 글을 쓴다.
- 이 프로젝트에서는 생성 모델(A.X 4.0 Light)이 이 역할을 한다.

### 토큰 (Token)

LLM이 글자를 처리하는 최소 단위. 단어보다 작을 수 있다.

- 영어는 보통 1단어≈1-2토큰, 한국어는 1글자≈1.5-3토큰(조사와 어미가 붙는 교착어라 더 잘게 쪼개짐).
- "토큰 수"는 곧 AI가 처리할 양이자 비용과 속도의 척도다.

### 컨텍스트 윈도우 (Context Window)

LLM이 한 번에 볼 수 있는 토큰의 최대 개수. "작업 기억력의 크기".

- 예: 8K 컨텍스트 = 약 8,000토큰까지 입력+출력 가능.
- 이보다 긴 문서는 잘라서 처리해야 한다(요약의 map-reduce, 청킹 참고).

### 프롬프트 (Prompt)

LLM에게 주는 입력 텍스트(지시문+질문+자료). "AI에게 시키는 말". 잘 쓰면 결과가 좋아진다(프롬프트 엔지니어링).

### 시스템 프롬프트 (System Prompt)

대화 맨 앞에 두는 역할과 규칙 지시. 예: "너는 문서 분석가다. 제공된 문서에만 근거해 한국어로 답하라." 사용자 질문보다 우선 적용된다.

### 환각 (Hallucination)

LLM이 사실이 아닌 내용을 그럴듯하게 지어내는 현상. RAG와 인용 강제(인용 항목 참고)는 이 환각을 줄이기 위한 장치다.

### 추론(Inference)

학습이 끝난 모델을 실제로 돌려서 결과를 얻는 것. "모델을 실행한다"는 뜻. (학습=training과 구분.)

### 파라미터 수 (7B, 32B …)

모델의 크기. B = Billion(10억). 7B = 70억 개의 가중치.

- 클수록 똑똑하지만 메모리와 연산이 더 든다.
- 이 프로젝트는 24GB 메모리에 맞춰 주로 7B급을 쓴다.

---

## C. 임베딩, 벡터, 검색

### 임베딩 (Embedding)

텍스트(또는 이미지)를 의미를 담은 숫자 목록(벡터)으로 변환하는 것.

- 핵심 아이디어: 의미가 비슷한 글은 비슷한 숫자 벡터가 된다. 그래서 "연봉"과 "급여"는 글자가 달라도 벡터가 가깝다.
- 키워드가 안 겹쳐도 의미로 검색할 수 있게 해주는 기반.

### 벡터 (Vector) / 차원 (Dimension)

숫자의 나열(예: `[0.12, -0.07, …]`). 차원 = 그 숫자의 개수.

- 이 프로젝트의 임베딩은 1024차원(숫자 1024개로 한 조각의 의미를 표현).
- 차원이 고정돼야 DB에 저장과 비교가 가능하다.

### 코사인 유사도 (Cosine Similarity)

두 벡터가 얼마나 같은 방향을 가리키는지로 의미 유사도를 재는 방법(1에 가까울수록 비슷).

- 의미 검색의 핵심 계산.
- pgvector에서 `<=>`(코사인 거리, 작을수록 가까움)로 쓴다.

### 청크 / 청킹 (Chunk / Chunking)

긴 문서를 검색과 임베딩에 좋게 작은 조각으로 나누는 것, 그 조각이 청크.

- 통째로 임베딩하면 의미가 뭉개지고 컨텍스트 윈도우도 넘치므로 조각낸다.
- 이 프로젝트는 512토큰/64토큰 겹침으로 나눈다(겹침=오버랩, 경계에서 문맥이 끊기지 않게 약간 겹치게 자름).

### 키워드 검색 (Full-Text Search, 전문 검색)

입력한 단어가 그대로 들어있는 문서를 찾는 전통 방식(Ctrl+F의 발전형).

- 정확한 이름과 숫자에 강하지만 동의어나 의미는 못 잡는다.
- 한국어는 조사 때문에 어려워 PGroonga라는 확장을 쓴다.

### 형태소 분석 (Morphological Analysis)

한국어 문장을 의미 단위로 쪼개는 것. 예: "연봉이"를 "연봉" + "이(조사)"로 분리. 기본 PostgreSQL은 한국어 형태소를 모르므로 별도 도구(PGroonga의 N-gram 또는 MeCab)가 필요하다.

### N-gram / Bigram

텍스트를 n글자씩 잘라 색인하는 기법. Bigram은 2글자씩 자른다("연봉"을 "연봉", "봉이"로). 사전 없이 한국어 부분 일치 검색을 가능케 한다(PGroonga 기본 방식).

### BM25 / tsvector

- **tsvector**: PostgreSQL 기본 전문 검색용 자료형(단어 색인).
- **BM25**: 검색 랭킹 표준 알고리즘.
  - 단어의 빈도(TF, Term Frequency)와 문서 집합 내 희귀도(IDF, Inverse Document Frequency)를 조합해 순위를 매긴다.
  - 흔한 단어(IDF 낮음)는 덜 중요하게, 희귀 단어(IDF 높음)는 더 중요하게 가중치를 준다.
  - 기본 `tsvector`엔 이 IDF 개념이 약하므로 BM25만큼 정확하지 않다.

### IDF (Inverse Document Frequency, 역문서빈도)

특정 단어가 전체 문서 집합에서 얼마나 드문지를 수치화하는 척도. 공식: `log(전체문서수 / 단어가포함된문서수)`.

- 예: "의", "이"처럼 많은 문서에 나오는 단어는 IDF가 낮아 가중치가 낮고, "연봉"처럼 소수 문서에만 나오는 단어는 IDF가 높아 가중치가 높다.
- TF-IDF와 BM25는 모두 IDF를 핵심으로 써서 희귀어를 강조한다.
- 차이점: TF-IDF는 IDF × TF의 단순 곱셈이고, BM25는 포화도와 문서 길이 정규화 등을 추가로 고려해 더 정교하다.

### 의미 검색 (Semantic Search) / 벡터 검색

질문을 임베딩해 벡터가 가까운 청크를 찾는 검색. 표현이 달라도 의미로 찾는다. 키워드 검색의 약점을 보완.

### 하이브리드 검색 (Hybrid Search)

키워드 검색 + 의미 검색을 합친 검색. 정확 매칭(키워드)과 의미 매칭(벡터)의 장점을 모두 취한다.

### RRF (Reciprocal Rank Fusion, 역순위 융합)

서로 점수 체계가 다른 두 검색 결과를 "순위"만으로 합치는 방법.

- 공식 `1/(k+순위)`의 합으로 재정렬(`k`는 보통 50~60).
- 점수 단위가 달라 더할 수 없는 키워드와 벡터 결과를 공정하게 섞는 표준 기법.

### 리랭킹 / 리랭커 (Reranking / Reranker)

1차로 찾은 후보(예: 50개)를 더 정밀한 모델로 다시 채점해 상위 몇 개만 남기는 단계. (쿼리, 문서)를 함께 보는 교차 인코더라 정확하지만 느려서 후보에만 적용한다.

### HNSW / IVFFlat (벡터 인덱스)

수많은 벡터 중에서 가까운 것을 빠르게 찾기 위한 색인 구조. 전수 비교는 느리므로 근사 검색을 쓴다.

- **HNSW**: 그래프 기반, 빠르고 정확. 이 프로젝트의 선택.
- **IVFFlat**: 군집 기반, 가볍지만 정확도와 속도가 열위.

### pgvector

PostgreSQL에 벡터 저장과 검색 기능을 더해주는 확장. 별도 벡터 DB 없이 익숙한 SQL로 의미 검색을 한다.

---

## D. RAG, AI 산출물

### RAG (Retrieval-Augmented Generation, 검색 증강 생성)

이 프로젝트의 핵심. 다음 두 단계로 동작한다.

- 질문과 관련된 문서 조각을 먼저 검색한다.
- 그 조각을 LLM에게 근거 자료로 주고 답하게 한다.

LLM이 모르는 우리 문서 내용을 "찾아서 보고 답하게" 만들어 환각을 줄이고 출처를 댈 수 있게 한다.

### 인용 / 출처 추적 (Citation / Grounding)

답변의 각 문장 뒤에 `[1]`처럼 근거가 된 청크 번호를 표시하는 것.

- 사용자가 "정말 맞나?"를 원문으로 확인할 수 있게 한다(연봉 액수 같은 민감 정보에 필수).
- Grounding=답을 자료에 "근거 지우는" 것.

### Map-Reduce (요약 기법)

컨텍스트 윈도우보다 긴 문서를 요약하는 방법.

- **Map**: 각 청크를 따로 요약한다.
- **Reduce**: 그 요약들을 다시 합쳐 최종 요약을 만든다.

(Stuff=통째로 한 번에, Refine=순차적으로 누적.)

### 계보 / 프로비넌스 (Lineage / Provenance)

AI가 만든 산출물에 대해 "무엇으로, 어떻게, 언제 만들었는가"를 추적 가능하게 기록하는 것. (데이터 "족보".)

- 기록 항목: 출처 문서와 청크, 프롬프트, 모델, 파라미터, 생성 시각 등.
- 재현성과 신뢰성(감사)을 위해 저장한다.

### Contextual Retrieval (맥락 보강 검색)

청크를 임베딩하기 전에 "이 조각이 문서 어디에 속하는지" 한 줄 설명을 앞에 붙여 검색 정확도를 높이는 Anthropic의 기법(선택 사항).

---

## E. 모델 런타임, 배포

### llama.cpp / llama-server

LLM을 개인 컴퓨터에서 효율적으로 실행하는 오픈소스 엔진(C/C++). `llama-server`는 그 위에 OpenAI 호환 HTTP API를 띄워주는 서버. 이 프로젝트의 로컬 AI 런타임.

### GGUF

llama.cpp가 쓰는 모델 파일 포맷. "llama.cpp용 모델 파일 확장자"로 이해하면 된다. HuggingFace의 원본(safetensors) 모델을 llama.cpp에서 돌리려면 GGUF로 변환과 양자화를 거친 파일이 필요하다.

### 양자화 (Quantization)

모델 가중치를 더 적은 비트로 압축해 메모리와 용량을 줄이는 것. 24GB 메모리에 큰 모델을 올리는 핵심 기술.

- Q4_K_M, Q5_K_M, Q8_0 등이 압축 수준(숫자가 작을수록 더 압축=가볍지만 품질 약간 손해).
- 예: 7B 모델이 Q4면 ~4.9GB, Q5면 ~5.5GB.

### mmproj

비전(이미지) 모델을 llama.cpp에서 쓸 때 필요한 보조 파일(이미지를 토큰으로 바꾸는 부분). OCR용 VLM(Qwen2.5-VL)에 함께 쓴다.

### VLM (Vision-Language Model)

이미지와 텍스트를 함께 이해하는 LLM. 사진 속 글자를 읽거나(OCR) 그림을 설명한다. 이 프로젝트는 어려운 OCR 페이지에 Qwen2.5-VL을 쓴다.

### OCR (Optical Character Recognition, 광학 문자 인식)

이미지/스캔 속 글자를 디지털 텍스트로 변환하는 기술. 사진과 스캔 PDF에서 글자를 뽑아낸다.

### Apple Silicon / Metal / 통합 메모리 (Unified Memory)

- **Apple Silicon**: 애플의 M 시리즈 칩(M4 등). CPU, GPU, 메모리가 한 칩에.
- **통합 메모리**: CPU와 GPU가 같은 메모리를 공유(별도 그래픽 메모리 없음). 24GB 전체를 모델이 쓸 수 있다는 게 장점.
- **Metal**: 애플의 GPU 가속 API. llama.cpp가 Mac에서 GPU 가속에 쓴다(`-ngl`로 GPU 오프로드).
- 일반 PC의 "VRAM(그래픽 카드 전용 메모리)"과 달리, 통합 메모리는 시스템과 공유하므로 macOS가 쓰는 몫(~3~4GB)을 빼고 모델 예산을 잡아야 한다.

### Provider (제공자) / AWS Bedrock

- **Provider**: AI 모델을 어디서 실행하는지(로컬 llama.cpp인지, 클라우드 API인지). 계보에 이 정보를 남긴다.
- **AWS Bedrock**: 아마존의 관리형 AI 서비스. Claude, Titan 등 모델을 API로 쓴다(직접 서버 운영 불필요). 이 프로젝트는 추후 무거운 모델을 Bedrock으로 돌릴 수 있도록 Provider 추상화(로컬과 Bedrock을 교체할 수 있는 인터페이스)를 둔다.

### GBNF(GGML Backus-Naur Form) / 제약 디코딩 (Constrained Decoding) / JSON Schema

LLM이 반드시 정해진 형식(예: 올바른 JSON)으로만 출력하도록 강제하는 기법. llama.cpp의 `--json-schema`/GBNF 문법으로, 소형 로컬 모델도 깨지지 않는 JSON을 내게 한다(메타데이터 추출과 쿼리 파싱에 사용).

### 풀링 (Pooling)

임베딩 모델이 여러 토큰의 벡터를 하나의 문장 벡터로 합치는 방식(`cls`, `mean`, `last` 등). 모델마다 정해진 방식이 있어 틀리면 결과가 무의미해진다(KURE/bge-m3=`cls`).

---

## F. 웹/백엔드 인프라

### FastAPI / Pydantic / SQLAlchemy / Alembic

- **FastAPI**: 파이썬 웹 API 프레임워크(백엔드 서버).
- **Pydantic**: 데이터 형식 검증 라이브러리(요청과 응답 스키마).
- **SQLAlchemy**: 파이썬 ORM(객체와 DB 테이블 매핑).
- **Alembic**: DB 스키마 변경 이력 관리(마이그레이션) 도구.

### 비동기 / async / 작업 큐 (arq, Redis)

- **비동기(async)**: 오래 걸리는 일을 기다리는 동안 서버가 다른 요청을 처리하게 하는 방식.
- **작업 큐(Task Queue)**: 무거운 작업(텍스트 추출, 임베딩, AI 생성)을 나중에 처리하도록 줄 세우는 장치. 사용자는 기다리지 않고, 백그라운드 워커가 처리한다. 이 프로젝트는 arq(큐) + Redis(줄을 담는 메모리 저장소)를 쓴다.

### 멱등성 (Idempotency)

같은 작업을 여러 번 실행해도 결과가 한 번 한 것과 같은 성질. 작업이 중간에 실패해 재시도해도 청크와 임베딩이 중복 생성되지 않게 하려고 필요하다.

### MinIO / presigned URL / S3

- **S3**: 아마존의 파일(객체) 저장 서비스 표준.
- **MinIO**: S3와 호환되는 자체 호스팅 파일 저장소(원본 PDF와 이미지를 여기 둔다).
- **presigned URL**: 임시 서명된 업로드/다운로드 링크. 브라우저가 서버를 거치지 않고 MinIO에 직접 파일을 올리고 내려받게 해 서버 부하를 던다.

### 인접 리스트 / 재귀 CTE (폴더 트리)

- **인접 리스트(Adjacency List)**: 각 폴더가 부모 폴더 id만 기억하는 트리 저장 방식. 폴더 이동=부모 id 한 줄만 바꾸면 됨.
- **재귀 CTE(`WITH RECURSIVE`)**: SQL에서 부모와 자식을 따라 트리 전체를 훑는 질의 문법. 하위 폴더 전부 찾기 등에 쓴다.

### RSC / 클라이언트 컴포넌트 (Next.js)

- **RSC(React Server Component)**: 서버에서 렌더링되는 컴포넌트(초기 로딩 빠름, 상호작용 없음).
- **클라이언트 컴포넌트(`"use client"`)**: 브라우저에서 도는 컴포넌트(클릭, 드래그 등 상호작용 담당). 파일 탐색 UI는 상호작용이 많아 클라이언트 컴포넌트가 중심.

### Vega-Lite

차트를 JSON으로 선언하면 그려주는 시각화 문법/라이브러리. 보고서의 그래프를 코드 실행 없이(안전하게) 생성하는 데 쓴다.

---

## G. NLP 기초

### NLP (Natural Language Processing, 자연어 처리)

컴퓨터가 인간의 언어를 이해, 생성, 분석하게 하는 기술 분야. LLM이 NLP의 최신 성과물이며, 임베딩, 형태소 분석, 개체명 인식 등이 모두 NLP의 세부 기술이다.

### 토크나이저 (Tokenizer)

텍스트를 토큰(모델이 처리하는 단위)으로 쪼개는 알고리즘. ([토큰](#토큰-token) 참고)

- 단순 공백 분리부터 BPE, WordPiece 같은 서브워드 방식까지 다양하다.
- 모델마다 전용 토크나이저가 있어 같은 문장도 모델마다 토큰 수가 다르다.

### BPE (Byte Pair Encoding) / WordPiece / SentencePiece

현대 LLM이 주로 쓰는 서브워드 토크나이저 계열.

- **BPE**: 자주 등장하는 바이트/글자 쌍을 반복적으로 합쳐 어휘를 만드는 방식(GPT 계열).
- **WordPiece**: BPE와 유사하되 확률을 기준으로 병합(BERT 계열).
- **SentencePiece**: 언어 독립적으로 동작하며 공백도 토큰으로 처리해 한국어와 일본어에 잘 맞는다.

### 불용어 (Stopwords)

"의", "이", "그", "a", "the" 처럼 문장에 자주 나오지만 핵심 의미를 담지 않는 단어.

- 전통 키워드 검색에서는 걸러내 색인 크기를 줄이고 노이즈를 낮추는 데 쓴다.
- 의미 검색(임베딩)은 불용어를 모델이 자연히 낮은 가중치로 처리하므로 명시적 제거가 불필요한 경우가 많다.

### 어간 추출 (Stemming) / 표제어 추출 (Lemmatization)

단어를 기본 형태로 정규화하는 두 방식.

- **Stemming**: 규칙으로 접사를 제거해 어간만 남김("running"을 "run"으로). 빠르지만 사전 미사용으로 부정확할 수 있다.
- **Lemmatization**: 형태소와 품사를 분석해 사전상 원형으로 되돌림("better"를 "good"으로). 정확하지만 느리다. 한국어에서는 형태소 분석이 이 역할을 한다.

### 품사 태깅 (POS Tagging, Part-of-Speech Tagging)

각 단어에 명사, 동사, 형용사 같은 문법적 역할을 붙이는 작업. 예: "연봉/NNG 이/JX 높다/VA". 개체명 인식, 형태소 분석, 검색 전처리에 기초로 쓰인다.

### 개체명 인식 (NER, Named Entity Recognition)

텍스트에서 인명, 지명, 기관명, 날짜, 금액 같은 고유 범주를 찾아내는 기술.

- 예: "홍길동이 2025년 3월 서울에서…"에서 `홍길동(인명)`, `2025년 3월(날짜)`, `서울(지명)`을 찾아낸다.
- 문서 메타데이터 자동 추출이나 구조화 질의에 활용할 수 있다.

### 문장 경계 탐지 (Sentence Boundary Detection / Sentence Segmentation)

긴 문단을 개별 문장으로 나누는 작업. 청킹 전처리나 단위별 요약에서 단순 개행/마침표 분리보다 정확한 분리가 필요할 때 쓴다. 약어나 소수점("3.14")을 문장 종결로 오해하지 않도록 처리가 필요하다.

### 텍스트 전처리 파이프라인 (Text Preprocessing Pipeline)

원문 텍스트를 모델과 검색에 넣기 좋게 정제하는 일련의 단계. 일반적인 순서는 다음과 같다.

- 노이즈 제거(HTML 태그, 특수문자)
- 정규화(대소문자, 유니코드 정규화)
- 토크나이징
- 불용어 제거 또는 POS 필터

이 프로젝트에서는 PDF 추출 후 헤더와 푸터 제거, 이중 공백 제거, 불필요한 줄바꿈 정리 등을 포함한다.

### 교차 인코더 (Cross-Encoder) vs 이중 인코더 (Bi-Encoder)

임베딩과 리랭킹에서 쓰이는 두 가지 NLP 모델 구조.

- **이중 인코더(Bi-Encoder)**: 쿼리와 문서를 따로 인코딩해 벡터로 만든 뒤 비교. 빠르고 대용량 색인에 적합(임베딩 기반 검색이 이 방식).
- **교차 인코더(Cross-Encoder)**: 쿼리와 문서를 함께 한 번에 넣어 연관도를 직접 출력. 정확하지만 느려서 리랭커처럼 후보를 좁힌 뒤에만 쓴다.

### 문서 유사도 / 중복 제거 (Document Similarity / Deduplication)

같은 내용의 문서와 청크가 중복 저장되지 않도록 유사도를 측정해 걸러내는 작업. 벡터 코사인 유사도, 지문(해시) 비교, Jaccard 유사도 등이 쓰인다.

---

## H. 약어 빠른 표

| 약어     | 풀이                               | 한 줄                                     |
| -------- | ---------------------------------- | ----------------------------------------- |
| NLP      | Natural Language Processing        | 자연어 처리 기술 분야                     |
| NER      | Named Entity Recognition           | 인명, 지명, 기관명 등 개체명 인식         |
| POS      | Part-of-Speech                     | 품사 태깅                                 |
| BPE      | Byte Pair Encoding                 | 서브워드 토크나이저 방식                  |
| SBD      | Sentence Boundary Detection        | 문장 경계 탐지                            |
| LLM      | Large Language Model               | 언어 생성 AI 모델                         |
| RAG      | Retrieval-Augmented Generation     | 검색해서 근거로 답하는 방식               |
| OCR      | Optical Character Recognition      | 이미지를 글자로 변환                      |
| VLM      | Vision-Language Model              | 이미지+글자 이해 AI                       |
| RRF      | Reciprocal Rank Fusion             | 검색 결과 순위 융합                       |
| HNSW     | Hierarchical Navigable Small World | 빠른 벡터 검색 색인                       |
| GGUF     | (없음)                             | llama.cpp 모델 파일 포맷                  |
| GBNF     | GGML Backus-Naur Form              | LLM 출력 형식 강제 문법                   |
| MRL      | Matryoshka Representation Learning | 임베딩 차원 가변 기법                     |
| KV cache | Key-Value cache                    | LLM이 대화 중 재사용하는 임시 메모리      |
| BM25     | (없음)                             | 키워드 검색 랭킹 알고리즘                 |
| IDF      | Inverse Document Frequency         | 검색의 단어 중요도 가중치(드문 단어 높음) |
| CTE      | Common Table Expression            | SQL 임시 결과 집합                        |
| RSC      | React Server Component             | 서버 렌더 컴포넌트                        |
| DMS      | Document Management System         | 문서 관리 시스템                          |

---
