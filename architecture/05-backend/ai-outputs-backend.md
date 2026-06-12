---
created: 2026-06-12
updated: 2026-06-12
status: draft
overview: AI 산출물·계보의 백엔드 구현 — API 계약, 워크플로우 구현, 비동기 생성, 계보 기록·산출물 문서화 흐름. 도메인 정의는 ai-outputs.md.
refs: research/03
---

# AI 산출물 & 계보 백엔드

- 공통 구조·Provider 추상화는 `backend.md`. 도메인 정의는 `ai-outputs.md`, 계보 DDL은 `generations-schema.md`.

## 1. API 계약
| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/generations` | `{kind, document_ids, options}` → 202 `{id}`. |
| GET | `/generations/{id}` | 상태·진행·결과(`output_document_id`·`latency_ms` 포함). |
| GET | `/generations/{id}/lineage` | 출처/프롬프트/차트 전체(인스펙터 계보 섹션용). |
| GET | `/generations?source_document_id=&kind=&user=` | "산출물 내역" — 원본 기준, `output_document_id` 존재 건만. |

## 2. 비동기 생성 흐름
- `POST /generations` → api가 `generations` 헤드를 `queued`로 먼저 기록(생성 ID 확정).
- arq enqueue 후 즉시 202. worker 픽업 → `running` → 워크플로우 → `succeeded`/`failed`.
- 멱등 키 `generation_id`. 진행은 `GET /generations/{id}` 폴링.

## 3. Summary 구현
- 길이 분기: `doc_tokens ≤ 0.6*ctx` → STUFF(1콜) / `> 0.6*ctx` → MAP-REDUCE / `> ~50청크` → HIERARCHICAL(섹션 그룹 재귀).
- 청크 미니요약 + 문서 최종요약 2단 저장, `[n]` 인용.

## 4. Draft 구현
- outline-then-expand: 요약들로 개요 제안 → 사용자 개요 편집 → 섹션별 관련 청크 검색·생성(`[n]`) → 조립·일관성 패스. 템플릿 선택.

## 5. Report 구현
- LLM 구조화 데이터 추출(rows) → Python 결정적 통계 계산 → LLM Vega-Lite 스펙 생성 → JSON 스키마 검증·수리 루프(≤5회) → react-vega 렌더 + 서사(`[n]`).

## 6. 계보·재현성 기록
- `succeeded` 시 출처(문서·청크)·프롬프트·`provider`/`model`/`seed`·디코딩 파라미터·차트를 계보에 스냅샷 기록(generations-schema.md).
- 모델/템플릿 변경이 과거 기록을 덮지 않게 행 단위 스냅샷.

## 7. 산출물 문서화 (materialization)
- `succeeded` 시 worker가 산출물(Markdown; report는 차트 spec 포함)을 오브젝트 업로드 + `documents` 행 생성 → 인제스트(청킹·임베딩)까지 수행(document/ingestion 흐름 재사용).
- `generations.output_document_id`에 결과 문서 id 기록. 출력 문서 삭제 시 `ON DELETE SET NULL`로 산출물 내역에서 비노출.
- 멱등: worker 작업은 멱등 키로 중복 enqueue 안전.

## 8. 운영 배포 전 TODO
- 차트 수리 루프 한도
  - 해결: [x]
  - 비고: ≤5회 후 실패 처리(§5).
- 장문 요약 지연/메모리
  - 해결: [ ]
  - 비고: HIERARCHICAL 분기(§3)로 완화, 부하 측정 필요.
