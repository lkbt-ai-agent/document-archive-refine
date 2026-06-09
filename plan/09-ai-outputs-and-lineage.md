# 09. AI 산출물 & 계보(Lineage) — 작성 플랜

> **산출물:** `architecture/09-ai-outputs-and-lineage.md`
> **상태:** ⬜ Not started
> **근거 research:** `research/03` 전반
> **선행:** 08-search-and-rag, 03-data-model, 04-backend-application

## 목적
Summary/Draft/Report 워크플로우, 차트 생성, 계보 데이터 모델, 비동기 생성 작업을 정의한다.

## 지켜야 할 제약
- 계보는 원격 PostgreSQL에 저장. 생성은 Provider 추상화(04 §6)로 실행, provider/model 스냅샷 기록.

## 작성 단계 (= 아키텍처 문서 섹션)
- [ ] S1. **개요/범위** — 산출물 3종(요약/초안/보고서)과 계보의 목적(신뢰·재현·감사).
- [ ] S2. **Summary 워크플로우** — 길이 분기(stuff / map-reduce / hierarchical), 청크 미니요약 + 최종요약 2단 저장, `[n]` 인용.
- [ ] S3. **Draft 워크플로우** — outline-then-expand(편집 가능한 개요 → 섹션 확장), 템플릿(보고서/제안서/공문), 인용 재사용.
- [ ] S4. **Report 워크플로우** — 데이터 추출(LLM) → **통계는 Python 결정적 계산** → Vega-Lite 스펙 생성 → JSON 스키마 검증·수리 루프 → react-vega 렌더 + 서사.
- [ ] S5. **계보 데이터 모델** — `generations`(헤드: kind/method/status/provider/디코딩 파라미터/seed/토큰/시간) + `generation_prompts`/`source_documents`/`source_chunks`/`charts`, `models`/`prompt_templates`. (03과 정합, 상세 DDL은 03.)
- [ ] S6. **재현성** — seed + 디코딩 파라미터 + 렌더된 프롬프트 + 모델 파일 해시 + provider/region 스냅샷. 로컬↔Bedrock 이식성.
- [ ] S7. **비동기 생성 작업** — `POST /generations`(queued+enqueue) → arq worker(running→succeeded/failed) → `GET /generations/{id}`(폴링) / `/lineage` / 목록("AI 생성 이력 요약").
- [ ] S8. **API 계약** — 산출물 생성/조회/이력/계보 엔드포인트 스키마.

## 캡처할 핵심 결정 (research)
- 차트는 Vega-Lite 선언형(코드 실행 X), 산술은 Python.
- 계보 행 단위 스냅샷(W3C PROV/Langfuse 정렬), 인용 `[n]↔chunk_id`.

## 다이어그램
- [ ] 요약 라우팅(stuff/map-reduce/hierarchical) 플로우.
- [ ] 생성 작업 상태 전이 + 계보 기록 시퀀스.

## 제약·리스크·오픈 이슈
- [ ] **Provider 기록 일관성** — provider/model/seed 누락 시 재현 불가.
- [ ] **차트 수리 루프 한도**(≤5회) 및 실패 처리.
- [ ] **장문 요약 비용** — 로컬 모델 지연/메모리.

## 완료 기준
- [ ] `architecture/09-*.md` 존재, S1~S8 충족.
- [ ] 계보가 재현·감사 가능한 필드를 모두 포함, Provider 스냅샷 연동 명시.
