---
created: 2026-06-11
completed: —
overview: 단위·파이프라인·검색평가·E2E·프론트·재현성 테스트 (arch 전반).
---

> 테스트 러너·라이브러리 버전은 context7 MCP로 확인.

## 백엔드·파이프라인
- [ ] A1 단위 — 폴더 사이클 방지, `owner_id` 스코프, presign 발급 권한.
- [ ] A2 파이프라인 — 추출/OCR/청킹/임베딩 멱등·재시작, 부분 실패 격리 (ingestion §3·§4).
- [ ] A3 삭제 정합 — 문서/폴더 CASCADE(청크·하위), 출처 삭제 후 계보 스냅샷 유지(`SET NULL`), 산출물 문서 삭제 시 내역 비노출 (documents-schema §2, generations-schema §2, ai-outputs §9).

## 평가·통합
- [ ] B1 검색 평가 게이트 — ~50 한국어 골든셋, Recall@5/@20, 인용 존재, CI 결정적 (search-and-rag §7).
- [ ] B2 E2E — 업로드 → 인제스트 → 검색 → RAG → 생성·계보 전 경로.

## 프론트·재현성
- [ ] C1 프론트 스모크 — 핵심 플로우 + 우측 인스펙터 토글 + 통합 검색(결과 Center) + presigned/CORS + 3단 반응형·라이트/다크.
- [ ] C2 재현성 — provider/model/seed 기록으로 동일 생성 재실행.
