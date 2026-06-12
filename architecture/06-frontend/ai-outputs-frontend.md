---
created: 2026-06-12
updated: 2026-06-12
status: draft
overview: AI 산출물 도메인의 프론트 구현(생성 트리거·산출물 내역·계보·차트)을 정의한다.
refs: research/04 §5
---

# AI 산출물 프론트엔드

- 셸/레이아웃은 `frontend.md`. 도메인 정의는 `ai-outputs.md`, API는 `ai-outputs-backend.md`.
- AI 산출물은 1급 문서라 Center 목록·검색·RAG에 일반 문서처럼 포함된다(ai-outputs.md §9).

## 1. 생성 트리거
- GenerationTrigger(Right): 요약/초안/보고서 생성 시작(Dialog) → `POST /generations`.
- 생성 진행은 `GET /generations/{id}` react-query 폴링, 완료·실패 Toaster 알림.

## 2. 산출물 내역
- ArtifactList "산출물 내역"(Right 인스펙터): 원본 기준 생성 이력(`GET /generations?source_document_id=`).
- row 클릭 → Center가 산출물 문서 폴더로 이동·선택.
- 출력 문서 삭제 시 내역에서 사라짐(`output_document_id` SET NULL).

## 3. 계보(Lineage) 인스펙터
- 산출물 문서(= 어떤 생성의 `output_document_id`)면 계보 섹션 표시.
- 부모 문서 링크(클릭=Center 이동)·종류·모델/provider/seed·생성 소요·프롬프트(접기)·인용 출처.
- 데이터=`GET /generations/{id}/lineage`(ai-outputs-backend.md). 일반 업로드 문서엔 미표시.

## 4. 차트 렌더
- Report 산출물의 차트는 react-vega로 선언형 스펙을 렌더.
- 생성 소요(`generations.latency_ms`)는 초 단위 표기.
