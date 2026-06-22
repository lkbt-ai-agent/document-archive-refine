---
created: 2026-06-12
updated: 2026-06-16
status: approved
overview: AI 산출물·계보 도메인의 백엔드 구현(API·워크플로우·비동기 생성·계보 기록)을 정의한다.
refs: docs/research/01-mvp-research/03
---

# AI 산출물 & 계보 백엔드

## 1. API 계약

| 메서드 | 경로                                           | 설명                                                       |
| ------ | ---------------------------------------------- | ---------------------------------------------------------- |
| POST   | `/generations`                                 | `{kind, document_ids, options}` → 202 `{id}`.              |
| GET    | `/generations/{id}`                            | 상태·진행·결과(`output_document_id`·`latency_ms` 포함).    |
| GET    | `/generations/{id}/lineage`                    | 출처/프롬프트/차트 전체(인스펙터 계보 섹션용).             |
| GET    | `/generations?source_document_id=&kind=&user=` | "산출물 내역" — 원본 기준, `output_document_id` 존재 건만. |

## 2. 비동기 생성 흐름

- 상태 정의는 ai-outputs.md §8.
- 흐름
  1. `POST /generations` → 헤드를 `queued`로 기록(ID 확정).
  2. arq enqueue 후 즉시 202 반환.
  3. worker가 `running`으로 전이.
  4. 워크플로우 실행.
  5. `succeeded`/`failed`로 종료.
- 멱등 키 `generation_id`. 진행은 `GET /generations/{id}` 폴링.

## 3. Summary 구현

- 길이 분기
  - `doc_tokens ≤ 0.6*ctx`: STUFF(1콜).
  - `> 0.6*ctx`: MAP-REDUCE.
  - `> ~50청크`: HIERARCHICAL(섹션 그룹 재귀).
- 청크 미니요약 + 문서 최종요약 2단 저장, `[n]` 인용.

## 4. Draft 구현

- outline-then-expand
  1. 요약들로 개요 제안.
  2. 섹션별 관련 청크 검색·생성(`[n]`).
  3. 조립·일관성 패스.
- 개요는 사용자 편집 없이 자동 확정한다(MVP, ai-outputs.md §4).

## 5. Report 구현

- 흐름
  1. LLM 구조화 데이터 추출(rows).
  2. Python 결정적 통계 계산.
  3. LLM Vega-Lite 스펙 생성(데이터값은 §2 통계를 코드가 주입, LLM은 mark/encoding 스켈레톤만).
  4. JSON 스키마 검증·수리 루프(≤5회). 5회 실패 시 결정적 폴백 스펙으로 차트 유지(행 0개면 생략), 생성은 계속(ai-outputs.md §5).
  5. react-vega 렌더 + 서사(`[n]`).

## 6. 계보·재현성 기록

- `generations.status`가 `succeeded`가 되면 출처(문서·청크)·프롬프트·`provider`/`model`/`seed`·디코딩 파라미터·차트를 계보에 스냅샷 기록(generations-schema.md).
- 모델/템플릿 변경이 과거 기록을 덮지 않게 행 단위 스냅샷.

## 7. 산출물 문서화 (materialization)

- 개념·산출물 내역·삭제 정합의 의미는 ai-outputs.md §9. 여기서는 구현만 다룬다.
- `generations.status`가 `succeeded`가 되면 worker가 산출물(Markdown; report는 차트 spec 포함)을 오브젝트 업로드 + `documents` 행 생성 → 인제스트(청킹·임베딩)까지 수행(document/ingestion 흐름 재사용).
- 산출물 `documents.folder_id`는 주 원본 문서와 같은 폴더로 설정한다(생성 후 일반 문서처럼 이동 가능).
- `generations.output_document_id`에 결과 문서 id 기록. 출력 문서 삭제 시 `ON DELETE SET NULL`로 산출물 내역에서 비노출.
- 멱등: worker 작업은 멱등 키로 중복 enqueue 안전.

## 8. 운영 배포 전 TODO

- 차트 수리 루프 한도
  - 해결: [x]
  - 비고: 수리 ≤5회 실패 시 해당 차트만 제외하고 생성은 계속(§5).
- 장문 요약 지연/메모리
  - 해결: [ ]
  - 비고: HIERARCHICAL 분기(§3)로 완화, 부하 측정 필요.
- 재현 정보 누락 방지
  - 해결: [x]
  - 비고: 성공 시 provider/model/seed 스냅샷 기록 강제(§6).
