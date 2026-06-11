---
created: 2026-06-11
updated: 2026-06-11
status: draft
overview: 문서를 업로드하면 AI가 읽고 이해해 검색·RAG·요약/초안/보고서를 제공하는 한국어 문서 아카이브.
refs: research/00, research/04, research/06-glossary
---

# 시스템 개요

## 1. 범위
- MVP: 폴더/문서 CRUD, 업로드, 텍스트 추출·OCR, 메타·임베딩, 하이브리드 검색, RAG 답변, AI 산출물(요약/초안/보고서)+계보.
- 비범위: 멀티테넌시·권한 세분화, AWS Bedrock 실구현(인터페이스만), 실시간 협업.

## 2. 컴포넌트
- web (Next.js) — 3-Panel UI, presigned 직접 업/다운로드. (로컬/서버)
- api (FastAPI) — REST·비즈니스 로직·presign 발급. (로컬/서버)
- worker (arq) — 인제스트·AI 생성 비동기 처리. (로컬/서버)
- Redis — arq 큐 백엔드. (별도 provisioning)
- llama-server — 생성(8080)·임베딩(8081). (개발자 Mac mini 네이티브 Metal)
- PostgreSQL+pgvector+PGroonga — 메타·청크·벡터·계보·검색. (원격)
- MinIO — 원본 파일. (원격)

## 3. 설계 결정
- 생성 LLM: A.X 4.0 Light 7B (Apache 2.0).
- 임베딩: KURE-v1 1024d (로컬 고정).
- OCR: PaddleOCR + Tesseract + (선택) Qwen2.5-VL — 어려운 페이지 온디맨드 폴백.
- 검색: PGroonga + pgvector, RRF k=50.
- 계보: `generations` 헤드 + 하위, 행 단위 스냅샷.
- Provider: 로컬 llama.cpp (추후 Bedrock 교체).
- 인프라 보정: **PG·MinIO 원격 고정** — 연결만, 로컬 중복 정의 금지.

## 4. 기술 스택
Next.js 16 / React 19 / TS / Tailwind 4 / shadcn · FastAPI / Pydantic v2 / SQLAlchemy 2 / Alembic · PostgreSQL+pgvector+PGroonga · MinIO · llama.cpp · arq/Redis.

## 5. 핵심 데이터 흐름
- 인제스트: 업로드(presigned) → 추출 → 메타 → 청킹 → 임베딩 → PG 저장.
- 질의(RAG): 질문 → 라우팅 → 하이브리드 검색 → 컨텍스트 조립 → 인용 강제 생성 → 답변+출처.
- AI 산출물: 선택 문서 → 요약/초안/보고서 생성 → 계보 기록.

## 6. 횡단 관심사
비동기·멱등성(arq), 계보·감사(generations), Provider 추상화(로컬↔Bedrock), 한국어 처리(UTF-8·PGroonga), 소유자 스코프(`owner_id` 강제).

## 7. 배포 토폴로지
1. 브라우저 → web → api → (Redis / worker / llama-server).
2. api·worker → 원격 PG(psycopg3), api → 원격 MinIO(presign 발급).
3. 브라우저 ↔ 원격 MinIO presigned PUT/GET 직접 전송.
4. 원격 경계: PG·MinIO만 원격. 나머지(api·worker·web·redis·llama-server)는 로컬/개발 환경.
