---
created: 2026-06-17
updated: 2026-06-17
status: approved
overview: llama.cpp로 로컬 서빙하는 생성/임베딩 모델의 선정 이유, 용도, 출처, 양자화를 정의한다.
refs: research/01-mvp-research/04 §6
---

# AI 모델 (llama.cpp 서빙)

## 1. 범위
- llama-server(infrastructure §6)로 로컬 서빙하는 모델 2종(생성, 임베딩)을 정의한다.
- 선정 축: 한국어 성능, Mac mini(Metal, 24GB) 실용 속도, 라이선스, 임베딩 차원 정합.

## 2. 생성 LLM (A.X 4.0 Light)
- 용도: 요약/초안/보고서 생성, 구조화 출력(GBNF), 자연어 질의 파싱.
- 선정 이유: SKT A.X 4.0 Light는 Qwen2.5 기반에 대규모 한국어 데이터를 추가 학습해 한국어 업무 성능이 우수하다. 7B 규모라 Metal에서 실용 속도를 낸다. 라이선스 Apache 2.0.
- 출처: HuggingFace `jayusop/A.X-4.0-Light-Q4_K_M-GGUF` (원본 `skt/A.X-4.0-Light`).
- 파일: `a.x-4.0-light-q4_k_m.gguf`, 약 4.44GB.
- 양자화: Q4_K_M (§4).

## 3. 임베딩 (KURE-v1)
- 용도: 문서 청크 임베딩, 의미 검색, RAG 검색. 출력 1024차원(전 시스템 통일).
- 선정 이유: KURE-v1은 BGE-M3를 한국어로 파인튜닝한 검색 특화 임베딩으로 한국어 retrieval 품질이 좋다. 출력 1024차원이 시스템 차원 lock-in과 일치한다.
- 출처: HuggingFace `Bingsu/KURE-v1-Q8_0-GGUF` (원본 `nlpai-lab/KURE-v1`).
- 파일: `kure-v1-q8_0.gguf`, 약 635MB.
- 양자화: Q8_0 (§4).

## 4. 양자화 선택
- 생성(Q4_K_M): 생성 품질 손실이 작고 메모리/속도 이득이 커 4비트를 택한다. 24GB에서 임베딩 서버와 공존한다.
- 임베딩(Q8_0): 임베딩 정밀도가 검색 정확도에 직접 영향을 준다. 모델이 작아(약 635MB) 8비트로 정밀도를 보존해도 비용 부담이 낮다.
- 원칙: 생성은 압축 우선, 검색 벡터는 정밀도 우선.

## 5. 다운로드 / 배치 / 교체
- 다운로드: `hf download <repo> <file> --local-dir ~/Desktop/models`.
- 배치: `~/Desktop/models/`. 기동은 `scripts/llama-{chat,embed}.sh`에 모델 경로를 주입한다(infrastructure §6).
- 교체: 임베딩 모델 교체 시 1024차원 유지가 필수다. 차원이나 모델이 바뀌면 기존 임베딩을 재생성해야 한다.
