# 03. AI 산출물 워크플로우 & 계보(Lineage)

> ### 💡 이 문서를 읽기 전에 (핵심 용어)
> - **요약 기법(stuff/map-reduce/refine):** 문서를 AI로 요약하는 3가지 방식. stuff=통째로 한 번에, map-reduce=조각별 요약 후 합치기, refine=조각을 순서대로 누적하며 다듬기.
> - **컨텍스트 윈도우:** AI가 한 번에 볼 수 있는 글자(토큰)의 최대 양. 이걸 넘기는 긴 문서라서 위 요약 기법이 필요하다.
> - **인용(citation):** AI 답변 문장 뒤에 `[1]`처럼 근거가 된 문서 조각 번호를 붙여, 원문으로 사실 확인이 되게 하는 것.
> - **초안(draft):** AI가 문서를 바탕으로 써 주는 보고서·제안서·공문 등의 1차 글.
> - **보고서/차트(Vega-Lite):** 차트를 (코드 실행 없이) JSON으로 선언하면 그려 주는 방식으로 만든, 그래프가 포함된 보고서.
> - **계보(Lineage/Provenance):** 이 AI 산출물이 "어떤 문서·프롬프트·모델·파라미터로, 언제 만들어졌는가"의 기록(족보).
> - **seed / 디코딩 파라미터:** AI 생성의 무작위성·창의성을 조절하는 설정값들. seed를 고정하면 같은 입력에서 같은 결과가 재현된다.
>

requirement TODO 해소: **Summary/Draft/Report 워크플로우 / 계보 메타데이터 설계**.

> **이 문서가 다루는 "AI 산출물"이란?** 요약(Summary)·초안(Draft)·보고서(Report)를 말한다. 즉 **AI가 우리 문서를 바탕으로 만들어 주는 2차 결과물**이다(원본 문서가 아니라, 그것을 가공한 결과).
> 그리고 **계보(Lineage)가 중요한 이유**는, 이런 산출물이 *어떤 원본 문서·청크·프롬프트·모델·파라미터로* 만들어졌는지를 추적해 두어야 결과를 **신뢰**하고(출처 확인) **재현**(같은 조건으로 다시 생성)할 수 있기 때문이다.

---

## 1. Summary — 장문 요약 워크플로우
llama.cpp 모델은 보통 8K–32K 컨텍스트(=한 번에 볼 수 있는 토큰 양). 대부분 문서는 한 윈도우에 들어가나 계약서·보고서·스캔 PDF는 초과.

| 방법 | 컨텍스트 처리 | 지연 | 일관성 | 인용성 | 판정 |
|---|---|---|---|---|---|
| **Stuff** | 윈도우 초과 시 실패 | 1콜 최속 | 최고 | 쉬움 | 들어가면 최선 |
| **Map-Reduce** | 무한 확장 | 낮음(병렬) | 양호(경계 손실 가능) | 청크 단위 추적 | 장문 기본 |
| Refine | 무한 확장 | 높음(순차) | 더 좋음 | 어려움 | 보류 |
| Hierarchical | 초장문/멀티문서 | 중 | 양호(구조) | 트리 인용 | 매우 김 |

### 결정 — "들어가면 stuff, 아니면 map-reduce, 매우 길면 hierarchical"
```
doc_tokens <= 0.6 * ctx  → STUFF (1콜, 문서 전체 인용)
doc_tokens >  0.6 * ctx  → MAP-REDUCE (map: 청크별 요약+chunk_id / reduce: 요약들 통합)
> ~50 청크              → HIERARCHICAL (섹션 그룹 재귀 reduce)
```
- Refine는 순차 루프라 로컬 MVP엔 느리고 인용성 저하 → "서사형 요약" 명시 요청 시에만.
- **한국어 프롬프트:** map은 청크별 핵심 ≤5개 번호 목록(전문용어 원형 유지)+`chunk_id` 태그. reduce는 "다음 요약들에서 핵심을 추출해 **한국어** 불릿으로 최종 요약 작성".
- **인용성(citation/grounding = 답을 출처 자료에 "근거 지우기"):** LlamaIndex `CitationQueryEngine` 패턴 — 각 소스를 `Source [n]:` 단위(≈512토큰)로 번호화해 LLM에 주고 "문장 뒤 `[n]` 표기, 모든 답변 최소 1개 인용" 강제. `[n]↔chunk_id` 저장.
- **2단계 모두 저장:** 청크 미니요약(재사용·미세 인용) + 문서 최종요약(감사 가능).

---

## 2. Draft — 문서 기반 초안 생성

> **초안(draft)** = AI가 선택한 문서를 근거로 써 주는 1차 글(보고서·제안서·공문 등). 핵심 패턴인 **outline-then-expand**는 *개요(목차)를 먼저 쓰고 → 각 섹션을 확장*하는 방식으로, 글이 옆길로 새거나 환각(사실이 아닌 내용을 지어냄)을 줄인다.

| 패턴 | 강점 | 약점 | MVP |
|---|---|---|---|
| 원샷 RAG | 단순 | 구조 이탈·장문 약함 | 백업 |
| **Outline-then-expand** | 통제성, 섹션 병렬, 환각↓ | 2+ 패스 | **권장** |
| **템플릿/구조 채움** | 통제성·예측 레이아웃, 도메인 환각↓ | 자유도↓ | **공문류 권장** |
| RAS(구조화) | 최고 grounding | 무거움 | 이후 |

### 결정 — 선택 템플릿 위 outline-then-expand
```
1. 사용자 문서 선택 + (선택)템플릿(보고서/제안서/공문/메모)
2. 개요 패스: 문서 요약들로 섹션 목록 제안 → 사용자 개요 편집(통제성!)
3. 섹션별 확장: 섹션 관련 청크 검색 → 섹션 생성, [n] 인용
4. 조립 + 라이트 일관성 패스
5. 저장: 개요, 섹션별 출처청크, 전체 계보
```
- 통제 레버: 템플릿 선택, **편집 가능한 개요**(최고 레버·저비용), 톤/길이, "근거 문서로만 작성" 토글, 인용 요구.
- §1과 동일한 `[n]` 인용 메커니즘 재사용.

---

## 3. Report — 차트 포함 보고서

> **보고서(Report)** = 표·그래프(차트)가 포함된 AI 산출물. 여기서 채택하는 **Vega-Lite**는 *차트를 JSON으로 선언*하면 그려 주는 방식이라, 파이썬 코드를 실제로 실행하지 않아도 돼서 안전하다.

차트 생성 2방식:

| | A. 코드 실행(Python/matplotlib 샌드박스) | B. 선언형 스펙(Vega-Lite/Chart.js JSON) |
|---|---|---|
| 보안 | 임의 코드 실행 → 격리 필요(microVM/gVisor) | **코드 실행 없음, 본질적 안전** |
| 신뢰성 | matplotlib 코드 오류多, 재시도 필요 | 스키마 검증. VegaChat 시각화오류 0.0% vs code-gen 30%+ |
| 상호작용 | 정적 이미지 | 인터랙티브, 프론트 재스타일 |
| 인프라 | 샌드박스 구축 | JS 라이브러리뿐 |
| MVP | 무거움 | **가볍고 안전** |

### 결정 — **B. Vega-Lite 선언형 스펙 + 검증/수리 루프**
```
1. LLM이 산문이 아니라 구조화 데이터 추출 → JSON rows [{label,value,group}]
2. 백엔드 Python이 통계(합/평균/추세) 결정적 계산   ← LLM에 산술 시키지 않음
3. LLM이 Vega-Lite 스펙 생성(또는 백엔드 템플릿)
4. 스펙을 Vega-Lite JSON 스키마로 검증 → 실패 시 알고리즘 수정 → LLM 수리(≤5회)
5. 프론트(react-vega) 렌더, LLM이 차트 주변 서사 작성 + [n] 인용
6. 저장: 추출 데이터표, 계산 통계, 차트 스펙, 서사, 전체 계보
```
- **핵심 정확성 원칙: 산술은 LLM이 아니라 Python이.** LLM은 데이터 추출·차트 구조만. 신뢰 보고서와 환각 보고서의 갈림.
- 임의 통계 분석이 필요한 코드 실행(E2B Firecracker 등)은 **MVP 이후**.

---

## 4. 계보(Lineage) 데이터 모델

> **계보(Lineage/Provenance)** = 이 AI 산출물이 "무엇으로·어떻게·언제 만들어졌는가"의 추적 기록. 신뢰(출처 확인)와 재현(같은 조건 재실행)을 위해 남긴다.

### 개념 정렬
- **[W3C PROV](https://www.w3.org/TR/prov-overview/):** 출처(provenance)를 기록하는 국제 표준 모델. 산출물·출처(Entity) ← 생성 실행(Activity) `used` 출처 / `wasAssociatedWith` Agent(사용자+모델), 산출물 `wasDerivedFrom` 출처. (아래 표들이 이 관계를 그대로 담는다.)
- **Langfuse:** trace(작업) ⊃ generation 관측(prompt, model, params, token usage, latency, version, ts) + retriever 관측.
- **재현성 핵심 = seed.** seed는 AI 생성의 무작위성을 고정하는 값으로, 같은 입력에서 **같은 결과를 재현**하게 한다. llama.cpp는 동일 모델+seed+params+프롬프트+빌드에서 결정적. → `seed`+**디코딩 파라미터**(temperature/top_p 등 출력의 무작위성·창의성을 조절하는 설정)+렌더된 프롬프트+모델 파일 해시 저장 시 재실행 가능.
- **Provider(제공자) = 모델을 어디서 실행했는지.** 이 프로젝트는 지금은 로컬 **llama.cpp**(Mac mini M4)로 돌리지만, 추후 무거운 모델은 **AWS Bedrock**(아마존의 관리형 클라우드 AI)에서 돌릴 수 있다. 아래 `generations.provider`/`models.provider` 컬럼이 `'llama.cpp'`(로컬)와 `'aws-bedrock'`(추후)을 구분해, **실행 위치가 바뀌어도 계보가 그대로 감사·재현 가능**하게 한다(자세한 사용법은 스키마 뒤 설명 참고).
- **C2PA/Content Credentials:** 동일 사실을 기록해두면 추후 서명된 "AI 생성 매니페스트" 발행 가능.

### PostgreSQL 스키마

> **이 표들이 담는 것(처음 보는 사람을 위한 한 줄 설명):** **한 번의 AI 생성 = `generations` 테이블의 한 행**이다. 그 한 행에, 이 산출물을 *어떤 문서·청크·프롬프트·모델·파라미터로* 만들었는지를 나머지 테이블들이 연결해 붙는다(출처 문서/청크 → 신뢰·인용, 프롬프트/모델/파라미터 → 재현). 즉 "AI 산출물 한 개의 족보"가 행 하나에서 시작해 가지를 뻗는 구조다.

```sql
-- 정적 레지스트리
CREATE TABLE models (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,                 -- 'a.x-4.0-light'
  file_path TEXT, file_sha256 TEXT,   -- 가중치 동일성
  quantization TEXT,                  -- 'Q5_K_M'
  context_window INT,
  provider TEXT NOT NULL DEFAULT 'llama.cpp',  -- 'llama.cpp'(로컬, Mac mini M4) | 'aws-bedrock'(추후)
  runtime_build TEXT,                 -- llama.cpp commit (Bedrock이면 클라우드 모델 id/region을 함께 기록 → 어디서 돌려도 재현 가능)
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE prompt_templates (
  id BIGSERIAL PRIMARY KEY,
  key TEXT NOT NULL,                  -- 'summary.map','draft.outline','report.chart'
  version INT NOT NULL, language TEXT DEFAULT 'ko',
  body TEXT NOT NULL,
  UNIQUE (key, version)
);

CREATE TYPE artifact_kind AS ENUM ('summary','draft','report');
CREATE TYPE gen_method AS ENUM ('stuff','map_reduce','refine','hierarchical','outline_expand','template_fill');
CREATE TYPE job_status AS ENUM ('queued','running','succeeded','failed','canceled');

-- 생성 실행(Activity = 계보 헤드 = Langfuse trace)
CREATE TABLE generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind artifact_kind NOT NULL, method gen_method,
  status job_status NOT NULL DEFAULT 'queued',
  -- agent/app
  user_id UUID REFERENCES users(id),
  app_name TEXT NOT NULL DEFAULT 'doc-archive', app_version TEXT, client TEXT,
  -- model/provider (스냅샷)  -- provider 예: 'llama.cpp'(로컬) | 'aws-bedrock'(추후 클라우드)
  model_id BIGINT REFERENCES models(id), provider TEXT,
  -- 디코딩 파라미터(스냅샷, 불변)  -- temperature/top_p/top_k = 출력의 무작위성·창의성 조절(높을수록 다양·창의적), seed = 고정 시 같은 결과 재현
  temperature REAL, top_p REAL, top_k INT, seed BIGINT,
  max_tokens INT, repeat_penalty REAL, stop_sequences TEXT[], decode_params JSONB,
  -- 검색 설정 스냅샷
  embedding_model TEXT, retrieval_k INT, retrieval_params JSONB,
  -- 사용량/시간
  prompt_tokens INT, completion_tokens INT, total_tokens INT, latency_ms INT,
  -- 결과 + 진행
  output_text TEXT, output_meta JSONB, error TEXT,
  progress_pct INT DEFAULT 0, progress_step TEXT,   -- 'map 4/12','section 배경'
  created_at TIMESTAMPTZ DEFAULT now(), started_at TIMESTAMPTZ, finished_at TIMESTAMPTZ
);

-- 프롬프트 출처: 템플릿 + '정확히 렌더된' 프롬프트
CREATE TABLE generation_prompts (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID REFERENCES generations(id) ON DELETE CASCADE,
  step TEXT, step_index INT,           -- 'map','reduce','section:배경'
  template_id BIGINT REFERENCES prompt_templates(id),
  rendered_prompt TEXT NOT NULL, rendered_system TEXT, raw_response TEXT,
  prompt_tokens INT, completion_tokens INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 출처 문서(PROV used / wasDerivedFrom)
CREATE TABLE generation_source_documents (
  generation_id UUID REFERENCES generations(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id),
  role TEXT,                           -- 'primary','context','template_example'
  PRIMARY KEY (generation_id, document_id)
);

-- 출처 청크 + 인용 매핑(미세 추적)
CREATE TABLE generation_source_chunks (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID REFERENCES generations(id) ON DELETE CASCADE,
  chunk_id UUID REFERENCES document_chunks(id),
  document_id UUID REFERENCES documents(id),
  citation_index INT,                  -- 사용자/모델에 보인 [n]
  retrieval_rank INT, similarity REAL, used_in_step TEXT
);
CREATE INDEX ON generation_source_chunks (generation_id);

-- 보고서 차트
CREATE TABLE generation_charts (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID REFERENCES generations(id) ON DELETE CASCADE,
  title TEXT, spec_format TEXT DEFAULT 'vega-lite',
  spec JSONB NOT NULL,                 -- 차트 스펙
  data_rows JSONB,                     -- 추출/집계 데이터
  computed_stats JSONB,                -- 코드가 계산한 통계(감사 가능)
  valid BOOLEAN, repair_attempts INT DEFAULT 0
);
```

이 스키마는 requirement의 계보 요구(출처 문서·출처 청크·프롬프트·모델·Provider·파라미터·생성 시각)를 모두 충족하고, **추가로** seed·token usage·앱 버전·검색 설정·렌더 프롬프트·차트 데이터까지 담아 **재현·감사·C2PA 준비**를 만족한다. 모델/템플릿 변경이 과거 기록을 덮지 않도록 **행에 스냅샷**.

> **Provider 이식성(portability)이 곧 감사 가능성:** 위 `provider` 컬럼과 `models` 테이블 덕분에, 같은 산출물을 **로컬 llama.cpp(현재, Mac mini M4)**에서 만들었든 **AWS Bedrock(추후, 관리형 클라우드 AI)**에서 만들었든 동일하게 기록·구분된다. Bedrock으로 돌릴 때는 `models` 행에 **클라우드 모델 id와 region**을 함께 적어 두어, *어디서 실행했든* 그 생성이 무엇으로 만들어졌는지 추적·재현된다. (스키마는 이미 provider/model 필드를 갖추고 있으므로 바꿀 것 없이, 위와 같이 채워 넣기만 하면 된다.)

---

## 5. 비동기 AI 작업 처리

> AI 생성은 수십 초~수 분 걸리므로, 사용자를 기다리게 하지 않고 **작업 큐**(무거운 작업을 줄 세워 백그라운드 워커가 처리하는 장치, 여기선 **arq**+Redis)에 넘긴다. 재시도 시 같은 결과가 중복 생성되지 않게 하는 성질이 **멱등성**이다.

| 옵션 | 비동기 | 상태/결과 | 크래시 생존 | 별도 프로세스 | MVP |
|---|---|---|---|---|---|
| BackgroundTasks | 웹 내 | ❌ | ❌ | ❌ | 데모뿐 |
| **arq + Redis** | ✅ | ✅ | ✅ | ✅ | **권장** |
| RQ | ❌ 포크 | ✅ | ✅ | ✅ | arq의 7–40배 느림(짧은 잡) |
| Celery | sync-first | ✅(Flower) | ✅ | ✅ | MVP 과함 |

### 결정 — **arq + Redis**, 진행/결과/이력은 `generations` 행에서 일원화
```
POST /generations            → generations 행(queued) + arq enqueue → 202 {id}
arq worker                   → running/started_at → 파이프라인(map-reduce/outline/report)
                               단계별 progress_pct/progress_step 갱신
                               완료: succeeded + output + tokens + finished_at / 실패: failed + error
GET  /generations/{id}       → 상태+진행 폴링(프론트 1–2s)
GET  /generations/{id}/lineage → 전체 계보(문서/청크/프롬프트/차트)
GET  /generations?user=&kind=  → 이력 목록("AI 생성 이력 요약")
```
- llama.cpp 잡은 자연 하위 단계(맵 N청크→리듀스 / 개요→섹션)가 있어 **coarse 진행률**을 같은 행에 기록 → Redis pub/sub 불필요.
- **우측 패널 "AI 생성 이력 요약"** 은 `generations` 한 테이블로 구동: 생성유형/대상문서/모델/생성일시/상태/토큰. 상세는 `/lineage`에서 렌더 프롬프트·출처청크(클릭 `[n]`)·차트.

---

## 6. AI 산출물 권고 요약

| 주제 | 권고 |
|---|---|
| 요약 | stuff→map-reduce→hierarchical 라우팅, refine 제외, 청크+문서 2단 저장, 한국어 불릿 |
| 인용 | `Source [n]:` 번호화 → `citation_index↔chunk_id`, 3종 산출물 공통 |
| 초안 | 선택 템플릿 위 outline-then-expand, **편집 가능 개요**가 핵심 레버 |
| 보고서 차트 | **Vega-Lite 선언형**(코드 실행 X), 스키마 검증+수리, **통계는 Python** |
| 계보 | `generations` 헤드 + 하위 4테이블, **seed+디코딩 파라미터+렌더 프롬프트+모델 해시** 스냅샷 |
| 비동기 | **arq+Redis**, 진행/결과/이력 단일 테이블, 프론트 폴링 |
