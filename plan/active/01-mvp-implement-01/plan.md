---
status: active
scope: mvp
kind: index
arch_ref: architecture/00-README.md
---

# MVP 구현 플랜 #1 (인덱스)

`architecture/` 설계를 기반으로 한 MVP 구현 작업 목록. 순서: **프론트 설계 → 인프라 → 백엔드 → 프론트 구현 → 테스트**.
각 항목은 완료 시 `[x]`로 체크. 세부 설계 근거는 해당 `architecture/NN` 참조.
**이 플랜은 Phase별 파일로 분리되어 있다(아래 링크).** 공통 규약은 본 인덱스에 둔다.

> **전역 제약:** PG·MinIO 원격 고정(연결만, 로컬 중복 정의 금지). 시크릿은 `.env`(=`.gitignore`)로만. DB는 전용 스키마 `archive`. 드라이버 psycopg3 async.
>
> **구현 규약:** 각 모듈(라이브러리/프레임워크/SDK) 구현 시 **context7 MCP로 최신 공식 문서를 조회**해 API·설정·버전을 확인한 뒤 작성한다(메모리 의존 금지). 예: Next.js 16/React 19, Tailwind 4, shadcn, FastAPI, SQLAlchemy/Alembic, arq, pgvector/PGroonga, llama.cpp. UI 컴포넌트 선정은 shadcn MCP 병행(arch 10 §9).
>
> **코드 스타일 규약(React/TS):** 직접 작성하는 **모든 함수는 `function` 키워드 대신 화살표 함수(`const f = () => {}`)**, 객체/클래스 메서드는 **ES6 단축 표현**을 사용한다. **예외:** shadcn/ui 등 **외부 라이브러리가 생성·제공한 코드**(예: `components/ui/*`)는 원본 스타일 유지(개작 금지). (이 규약은 `web/AGENTS.md`에도 명시.)

---

## Phase 파일
진행 순서대로 (각 파일이 해당 Phase의 작업 목록):

| Phase | 파일 | 범위 | 비고 |
|---|---|---|---|
| 1 | [phase1-frontend-prototype.md](./phase1-frontend-prototype.md) | 프론트엔드 설계 + UI 프로토타입 (arch 10) | **🚦 게이트**: Phase 2 진입 전 사용자 재검수 필수 |
| 2 | [phase2-infra.md](./phase2-infra.md) | 인프라 셋업 (arch 02) | 원격 PG/MinIO 연결, 로컬 Redis·llama |
| 3 | [phase3-backend.md](./phase3-backend.md) | 백엔드 구현 (arch 03~09) | 기반/모델/Provider/폴더/스토리지/인제스트/검색·RAG/산출물 |
| 4 | [phase4-frontend.md](./phase4-frontend.md) | 프론트엔드 구현 (arch 10) | Phase 1 프로토타입 승계 → 실 API 배선 |
| 5 | [phase5-test.md](./phase5-test.md) | 테스트 | 단위/파이프라인/검색평가/E2E/프론트/재현성 |

> 참고(transient): [phase1-gate-outputs.md](./phase1-gate-outputs.md) — Phase 1 게이트 산출물(와이어프레임·토큰·UX 플로우). `architecture/`가 SoT이며 코드 흡수 후 폐기 대상.

---

## 리스크 / 오픈 이슈
- 확장 `CREATE` 권한 부재 가능 → Phase 2.2 선행 차단점(실패 시 DBA 요청).
- MinIO http(비TLS)·공인 IP → presign TTL 단축·접근 제어, 운영 전 TLS 필수(arch 06 §10).
- llama-server Mac mini 가용성(개발 의존), HNSW 빌드 비용(원격 리소스).
- 임베딩 1024d 고정 — 변경 시 전량 재임베딩.

## 완료 기준 (DoD)
- [ ] 업로드→인제스트→검색/RAG→AI 산출물 전 경로가 원격 PG/MinIO 기준으로 동작.
- [ ] 로컬 PG/MinIO 신규 정의 없음(원격 연결만).
- [ ] 검색 평가 게이트 통과(목표 Recall 충족), 모든 생성에 계보 기록.
