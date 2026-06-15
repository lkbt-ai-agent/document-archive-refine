# Document Archive AI — 세부 설계 보고서

`requirement.md`의 모든 TODO 항목을 외부 설계·구현 사례 조사를 바탕으로 해소한 2주 MVP 세부 설계 보고서입니다.
조사일 기준: 2026-06-09. 모든 권고는 다음 4가지를 1차 제약으로 두고 도출했습니다:

1. **로컬 AI 런타임** = llama.cpp
2. **한국어** 문서/사용자
3. **2주** 개발 기간
4. **로컬 배포 환경** = Mac mini(M4) + **24GB 통합 메모리**, **추후 일부 모델은 AWS Bedrock** 전환 가능

## 문서 구성

| 문서                                                           | 내용                                                                                                                 | 해소하는 requirement TODO                             |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| [00-summary-and-decisions.md](./00-summary-and-decisions.md)   | **배포 환경(Mac 24GB·Provider 추상화)**, 핵심 결정 요약, 모델 3종 최종 선정, 시스템 구성도, 2주 일정                 | OCR/Embedding/Generation 모델 결정, 하드웨어, Bedrock |
| [01-document-processing.md](./01-document-processing.md)       | 텍스트 추출(타입별), OCR, 메타데이터 생성, 임베딩, 청킹                                                              | 텍스트 추출 / 메타데이터 / 임베딩                     |
| [02-search-and-rag.md](./02-search-and-rag.md)                 | 키워드 검색, 의미 검색, 하이브리드(RRF), 리랭킹, 자연어 질의, RAG 파이프라인                                         | 검색 / 자연어 검색                                    |
| [03-ai-outputs-and-lineage.md](./03-ai-outputs-and-lineage.md) | Summary/Draft/Report 워크플로우, 차트 생성, 계보(Lineage) 데이터 모델, 비동기 작업                                   | AI 산출물 워크플로우 / 계보                           |
| [04-architecture.md](./04-architecture.md)                     | **Provider 추상화**, 폴더 트리 모델, 스토리지, 백엔드 구조, 데이터 모델 전체, 프론트엔드, 인프라(**Mac/Metal 주의**) | 레이아웃 / 데이터 모델                                |
| [05-references.md](./05-references.md)                         | 주제별 출처 목록 및 검증 caveat(하드웨어·Provider 포함)                                                              | —                                                     |

## 한눈에 보는 최종 결정 (TL;DR)

| 항목                | 결정                                                                                                              | 비고                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **로컬 하드웨어**   | **Mac mini M4 + 24GB 통합 메모리**, llama.cpp **Metal** 가속                                                      | 생성(Q4)+임베딩 상주, OCR VLM 온디맨드(llama-swap)                                           |
| **Provider 추상화** | 로컬 llama.cpp 기본, **추후 생성/OCR만 AWS Bedrock 전환 가능**                                                    | 임베딩은 로컬 고정(차원 lock-in). 계보에 provider 기록                                       |
| **생성 모델**       | **SKT A.X 4.0 Light 7B** (GGUF, **Mac 24GB 동시운용 시 Q4_K_M** / 단독 Q5_K_M)                                    | Apache 2.0, 한국어 KMMLU에서 EXAONE 3.5 7.8B 상회. EXAONE은 전 버전 **비상업(NC)** 이라 제외 |
| **임베딩 모델**     | **KURE-v1** (bge-m3 한국어 파인튜닝, 1024-dim, 8192 ctx)                                                          | Ko-MTEB 1위. 대안 BAAI/bge-m3                                                                |
| **OCR**             | **PaddleOCR PP-OCRv5(한국어)** 기본 + **Tesseract `kor`** 폴백 + **Qwen2.5-VL-7B**(난이도 높은 페이지, llama.cpp) | GOT-OCR2.0(llama.cpp 미지원)·docTR(한국어 없음) 제외                                         |
| **PDF 추출**        | **pypdf(BSD)** 텍스트 + pdfplumber(MIT) 표 보강, 페이지별 OCR 폴백                                                | PyMuPDF는 AGPL-3.0이라 제외(허용형 라이선스만 사용)                                          |
| **키워드 검색**     | **PGroonga (TokenBigram)**                                                                                        | Postgres 기본 FTS는 한국어 형태소 미지원                                                     |
| **하이브리드 검색** | PGroonga + pgvector, **RRF(k=50)** 단일 SQL                                                                       | 리랭커는 토글로 후순위(bge-reranker-v2-m3)                                                   |
| **벡터 인덱스**     | pgvector **HNSW**, `vector_cosine_ops`, dim **1024**                                                              | `m=16, ef_construction=200`                                                                  |
| **폴더 트리**       | **인접 리스트(`parent_id`) + 재귀 CTE**, `ON DELETE CASCADE`                                                      | MOVE = 1행 update                                                                            |
| **파일 스토리지**   | MinIO + **presigned PUT/GET**, object key `docs/{uuid}`                                                           | 폴더 경로와 키 분리                                                                          |
| **비동기 처리**     | **arq + Redis**                                                                                                   | BackgroundTasks는 상태추적 불가로 제외                                                       |
| **차트 생성**       | **Vega-Lite 선언형 스펙**(코드 실행 X), 통계는 Python이 계산                                                      | 보안·신뢰성 우위                                                                             |
| **계보**            | `generations` 헤드 + 하위 테이블, seed·디코딩 파라미터·렌더된 프롬프트 스냅샷                                     | W3C PROV / Langfuse 정렬                                                                     |
| **구조화 출력**     | llama.cpp `--json-schema` (GBNF)                                                                                  | 메타데이터 추출·쿼리 파싱                                                                    |
| **런타임**          | **Mac 호스트에서 네이티브 llama-server**(생성+임베딩 2개) + (선택) llama-swap로 VLM 핫스왑                        | `--embeddings`는 전용 프로세스. **Docker 금지**(Mac에서 Metal 불가) → 인프라만 Docker        |

> 각 결정의 근거·비교표·대안은 해당 세부 문서를 참조하세요.
