---
created: 2026-06-11
updated: 2026-06-12
status: approved
overview: 문서를 업로드하면 AI가 읽고 이해해 검색·RAG·요약/초안/보고서를 제공하는 한국어 문서 아카이브.
refs: research/01-mvp-research/00, research/01-mvp-research/04
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

## 6. 실행 흐름

- 브라우저가 web(Next.js)을 거쳐 api를 호출한다.
- api는 Redis·worker·llama-server를 사용한다.
- api·worker는 원격 PostgreSQL(psycopg3)에 접속한다.
- api는 원격 MinIO presign을 발급한다.
- 브라우저는 원격 MinIO와 presigned PUT/GET으로 직접 주고받는다.
