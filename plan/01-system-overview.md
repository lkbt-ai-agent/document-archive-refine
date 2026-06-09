# 01. 시스템 개요 아키텍처 — 작성 플랜

> **산출물:** `architecture/01-system-overview.md`
> **상태:** ⬜ Not started
> **근거 research:** `research/00-summary-and-decisions.md`, `research/04-architecture.md`, `research/README.md`
> **선행:** 없음 (최상위 문서)

## 목적
전체 시스템의 컨텍스트, 구성요소, 배포 토폴로지, 기술 스택, 횡단 관심사를 한 장으로 제시한다. 이후 모든 기능 문서의 진입점.

## 지켜야 할 제약
- 배포 토폴로지에서 **PostgreSQL·MinIO는 원격(49.247.14.186) 기존 인스턴스**로 그린다. 로컬 신규 인스턴스 금지.
- Redis·llama-server는 별도 컴포넌트로 표기(원격 PG/MinIO와 구분).

## 작성 단계 (= 아키텍처 문서 섹션)
- [ ] S1. **개요/범위** — 제품 한 줄 정의(문서 업로드 → AI 이해 → 검색·질문·요약), MVP 범위와 비범위.
- [ ] S2. **요구사항 매핑** — requirement 주요 기능 ↔ 기능 문서(05~10) 매핑 표.
- [ ] S3. **시스템 컨텍스트 다이어그램** — 사용자(브라우저) ↔ 프론트(Next.js) ↔ 백엔드(FastAPI) ↔ {원격 PostgreSQL, 원격 MinIO, Redis, llama-server}.
- [ ] S4. **컴포넌트 구성도** — web / api / worker(arq) / llama-server(생성·임베딩) / 원격 DB / 원격 MinIO / Redis. 각 컴포넌트 책임 1줄.
- [ ] S5. **기술 스택 표** — Next.js 16/React 19/TS/Tailwind4/shadcn · FastAPI/Pydantic v2/SQLAlchemy 2/Alembic · PostgreSQL+pgvector+PGroonga · MinIO · llama.cpp · arq/Redis.
- [ ] S6. **핵심 데이터 흐름** — (a) 인제스트: 업로드→추출→메타→청킹→임베딩→저장, (b) 질의: 질문→검색→근거 답변(RAG), (c) AI 산출물: 요약/초안/보고서+계보.
- [ ] S7. **횡단 관심사** — 비동기/멱등성, 계보·감사, Provider 추상화(로컬 llama ↔ 추후 Bedrock), 한국어 처리, 인증/소유자 스코프(`owner_id`).
- [ ] S8. **배포 토폴로지** — 원격 PG/MinIO + api·worker·web·redis + **llama-server(개발자 Mac mini, 네이티브 Metal 실행 확정)**. **원격/로컬 경계를 명확히 표기.**
- [ ] S9. **TL;DR 결정표** — README의 결정표를 원격 인프라 제약 반영해 갱신 인용.

## 캡처할 핵심 결정 (research)
- 모델 3종: 생성=A.X 4.0 Light, 임베딩=KURE-v1(1024d), OCR=PaddleOCR+Tesseract+(선택)Qwen2.5-VL — **Qwen2.5-VL은 표·복잡 레이아웃 등 전통 OCR이 약한 "어려운 페이지"의 VLM OCR 폴백**(상시 X, 온디맨드 로드).
- llama-server는 **MVP 기준 개발자 Mac mini(M4)에서 네이티브 실행(Metal)으로 확정** — 백엔드는 해당 호스트 URL로 접속.
- 하이브리드 검색(PGroonga+pgvector, RRF), 계보(generations), Provider 추상화.
- **인프라 보정:** research의 "인프라도 Docker" → 본 프로젝트는 **PG/MinIO 원격 고정**.

## 다이어그램
- [ ] 시스템 컨텍스트(Mermaid flowchart) — 원격 경계 박스 표시.
- [ ] 인제스트/질의 데이터 흐름(Mermaid flowchart).

## 제약·리스크·오픈 이슈
- [x] llama-server 실행 위치 — **개발자 Mac mini(M4) 네이티브 실행으로 확정**(추후 Bedrock 전환 시 Provider만 교체).
- [ ] 인증/사용자 모델 범위(`users` 테이블) 존재 여부 확인(스키마가 `owner_id` 참조).

## 완료 기준
- [ ] `architecture/01-system-overview.md` 존재, S1~S9 충족.
- [ ] 배포 토폴로지에서 PG/MinIO가 원격으로만 표기됨.
- [ ] 이후 기능 문서로의 링크가 모두 연결됨.
