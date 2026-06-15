---
created: 2026-06-16
completed: —
overview: architecture에서 점진적으로 확정된 결론을 research/01-mvp-research의 결론으로 역반영하기 위한 비교 분석과 조치 목록이다.
---

# research 결론을 architecture 확정안에 맞추는 계획

- 배경: research/01-mvp-research는 MVP 설계의 모든 조사 내용을 담는다. 결론(채택안)은 research에서 확정한 게 아니라 architecture로 옮기며 점진적으로 확정됐다.
- 따라서 두 문서가 갈리는 지점은 거의 architecture가 최신 확정안이고 research가 옛 결론이다.
- 목표: 아래 항목대로 research의 "결론" 문장을 architecture 확정안에 맞춘다. 조사, 비교, 근거 서술은 그대로 두고 결론만 갱신한다.
- 주의: 이 보고서는 계획이다. 실제 research 문서는 아직 수정하지 않는다.
- 표기: 항목 번호는 안정 ID. 각 항목은 "research 위치(옛 결론), architecture 확정안" 형식이며 `(arch …)`는 확정안 근거 위치다.

## A. 선행 조건: architecture에서 먼저 확정 (그 뒤 research 반영)

- [ ] A1 리랭킹 정책이 architecture 내부에서 불일치한다(도메인 "MVP 제외" vs 백엔드 "선택 토글"). architecture에서 한쪽으로 확정한 뒤 그 결론을 research/02 §3, §4에 반영 (arch 03-domains/search-and-rag §5, 05-backend/search-backend §4, §7).

## B. research 결론 갱신: 사실 충돌

- [ ] B1 DB 비동기 드라이버: research/04 §3, §6.2의 "asyncpg" 결론을 psycopg3로 갱신 (arch 05-backend/backend §5, 02-infrastructure/infrastructure §3, 04-data/data-overview §4).
- [ ] B2 인용 원본 삭제: research/03 §4의 "FK 삭제 차단" 결론을 "ON DELETE SET NULL + cited_text, cited_title 스냅샷으로 삭제 허용"으로 갱신 (arch 04-data/generations-schema §2, §3).

## C. research 결론 갱신: 설계 변경

검색, RAG:
- [ ] C1 research/02 §2, §7의 하이브리드 검색 + RRF(k=50) 결론을 "의미검색 단독 RAG"로 갱신 (arch 03-domains/search-and-rag §2, §4, 04-data/search-schema §1, §2).
- [ ] C2 research/02 §1의 키워드 검색 대상 `documents.content`(문서 단위) 결론을 `document_chunks.content`(청크 단위, 소유자 필터는 상위 문서 경유)로 갱신 (arch 04-data/search-schema 서문, §1).

인제스트, 문서:
- [ ] C3 research/00 §0.1, §1.3, §2와 research/01 §3.2, §3.3, §7의 VLM(Qwen2.5-VL) OCR 결론을 "PaddleOCR + Tesseract만, VLM 미채택"으로 갱신 (arch 05-backend/ingestion-backend §2-2, 01-overview/system-overview §2).
- [ ] C4 research/01 §5.3, §5.4의 Contextual Retrieval 권장과 `context` 컬럼 결론을 "MVP 미적용, context 컬럼 제거"로 갱신 (arch 05-backend/ingestion-backend §2-4, 04-data/documents-schema §1).

AI 산출물, 계보:
- [ ] C5 research/03 §4의 `gen_method` enum 결론을 architecture 확정값으로 갱신(`refine`, `template_fill` 제거, `report_pipeline` 추가) (arch 04-data/generations-schema §1).
- [ ] C6 research/03 §1의 `refine` 사용 결론을 "제외"로 갱신 (arch 03-domains/ai-outputs §3).
- [ ] C7 research/03 §2의 Draft 템플릿, `template_fill` 결론을 "`outline_expand`만"으로 갱신 (arch 03-domains/ai-outputs §4).
- [ ] C8 research/03 §4의 `job_status`에서 `canceled`를 빼 architecture 확정값에 맞춘다 (arch 04-data/generations-schema §1, 03-domains/ai-outputs §8).
- [ ] C9 research/03 §4의 계보 스키마 결론을 architecture 확정안으로 갱신(output_document_id, cited_text, cited_title, surrogate PK, head 컬럼 정리, generation_prompts 토큰 컬럼 제거) (arch 04-data/generations-schema §1, 03-domains/ai-outputs §9).

인프라, 데이터:
- [ ] C10 research/04 §6.2의 로컬 Docker `db`, `minio` 결론을 "PostgreSQL, MinIO 원격"으로 갱신 (arch 02-infrastructure/infrastructure §7, 01-overview/system-overview §2).
- [ ] C11 research/04 §1, §6.2의 단일 DB, 미수식 DDL 결론에 "archive, archive_ext 스키마 격리 + search_path"를 반영 (arch 02-infrastructure/infrastructure §3, 04-data/data-overview §1, §3).
- [ ] C12 research/04 §2, §6.2의 MinIO 이중 엔드포인트 결론을 "단일 엔드포인트(원격 공인 IP)"로 갱신 (arch 02-infrastructure/infrastructure §2, §4).
- [ ] C13 research/04 §3의 `pipeline/llama_client` 모듈 결론을 "별도 `ai/` 모듈"로 갱신 (arch 05-backend/backend §3).

## D. 갱신 전 확인 (architecture에서 결론이 덜 굳은 항목)

- [ ] D1 `parent_doc_id` 활용(간이 parent-document retriever)이 architecture에 미문서화. 채택 여부 확정 후 research/01 §5.3 결론 정리.
- [ ] D2 거리 연산자: research의 내적(`<#>`) 대안 vs architecture cosine(`<=>`) 확정. research를 cosine으로 정리(영향 없음).
- [ ] D3 `host.docker.internal`(research/04 §6) 세부는 api, worker 배포 형태(Docker 여부) 확정 후 정리.
- [ ] D4 페이지네이션 규약은 architecture 신규(backend §7), research는 미규정이라 충돌 없음. 필요 시 research에 추가만.

## 원칙

- research는 조사, 비교, 근거를 모두 보존한다. 위 항목은 결론(채택안) 문장만 architecture 확정안에 맞추는 작업이다.
- architecture가 아직 모순이거나 결론이 덜 굳은 항목(A1, D1, D3)은 architecture에서 먼저 확정한 뒤 반영한다.
- 실제 문서 수정은 별도 승인 후 진행한다. 본 보고서는 계획이다.
