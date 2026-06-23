---
created: 2026-06-11
updated: 2026-06-22
status: approved
overview: 문서를 업로드하면 AI가 읽고 이해해 검색·RAG·요약/초안/보고서를 제공하는 한국어 문서 아카이브.
refs: docs/research/01-mvp-research/00, docs/research/01-mvp-research/04
---

# 시스템 개요

## 0. 데드라인

- MVP: 2026-06월 말
- 추가 범위: to-do

## 1. 기능 정의

- MVP
  - 폴더/문서 CRUD·업로드
  - 텍스트 추출·OCR·메타·임베딩
  - 검색(키워드·의미)·RAG 답변
  - AI 산출물(요약/초안/보고서)+계보
- 비범위
  - 멀티테넌시·권한 세분화
  - AWS Bedrock 실구현(인터페이스만)

## 2. 컴포넌트 기술 스택

### 프론트엔드

- web: Next.js 16 · React 19 · TypeScript · Tailwind 4 · shadcn/ui.

### 백엔드

- api: FastAPI · Pydantic v2 · SQLAlchemy 2 · Alembic.
- worker: arq 비동기 처리(인제스트·AI 생성).

### DB

- Redis: 로컬 Docker, arq 큐 백엔드.
- PostgreSQL + pgvector + PGroonga: 원격, 메타·청크·벡터·계보·검색.
- MinIO: 원격, 원본 파일.

### AI

- llama-server (llama.cpp): 로컬 Metal, 생성 8080 / 임베딩 8081.

## 3. 설계 결정

- 생성 LLM A.X 4.0 Light 7B(Apache 2.0), 임베딩 KURE-v1 1024d 로컬 고정.
- OCR·추출·청킹 도구는 인제스트 단계에서 선택한다.
- 검색은 키워드(희소)·의미(밀집)로 분리, RAG는 의미 검색 기반.
- 계보는 행 단위 스냅샷.
- Provider 추상화: 로컬 llama.cpp(추후 Bedrock 교체).

## 4. 핵심 데이터 흐름

- 인제스트: 업로드 문서를 추출·임베딩해 적재.
- 질의: 키워드/의미 검색과 RAG 답변.
- AI 산출물: 요약/초안/보고서 생성 + 계보 기록.

## 5. 횡단 관심사

- 비동기·멱등성(arq)
- 계보·감사(generations)
- Provider 추상화(로컬/Bedrock)
- 한국어 처리(UTF-8·PGroonga)
- 소유자 스코프(`owner_id` 강제).

## 6. 인제스트 워크플로

문서 업로드부터 검색 가능 상태까지 모듈이 동작하는 시간 순서다.

1. 업로드 준비: 브라우저가 api에 업로드를 요청하고, api는 `documents` 행을 만들고(`status=uploaded`) MinIO presigned PUT URL을 발급한다.
2. 원본 적재: 브라우저가 그 URL로 MinIO에 파일을 직접 올린다(api를 거치지 않는다).
3. 업로드 확정: 브라우저가 api에 확정을 알리고, api는 MinIO에서 업로드를 확인한 뒤 Redis 큐에 인제스트 작업을 등록한다.
4. 추출(extracting): 워커가 MinIO에서 파일을 받아 타입을 판별하고 본문과 표를 추출한다. 스캔이나 이미지는 OCR로 처리한다.
5. 메타 생성(generating_meta): 워커가 언어를 감지하고 생성 LLM(8080)으로 제목·요약·키워드를 만든다.
6. 청킹(chunking): 워커가 본문을 검색용 청크로 나눈다.
7. 임베딩(embedding): 워커가 임베딩 LLM(8081)으로 각 청크를 벡터로 바꿔 PostgreSQL(pgvector)에 적재한다.
8. 완료(ready): 워커가 상태를 `ready`로 두고 소요 시간을 기록한다. 실패하면 `failed`로 종결한다.
9. 표시: 프론트가 상태와 단계를 폴링해 진행을 보여주고, 완료 뒤 메타·검색·RAG에 쓴다.

- 4단계부터 8단계까지는 워커가 비동기로 처리하며 각 단계는 멱등이다(횡단 사항은 §5).
- 동시 처리 수는 워커 잡 4개, 생성 llama(8080) 슬롯 4개, 임베딩 llama(8081) 슬롯 1개다. 워커 잡은 KV 캐시 경합을 막으려 생성 슬롯 수에 맞춰 4로 둔다.
