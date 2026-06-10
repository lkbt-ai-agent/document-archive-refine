---
status: active
scope: mvp
phase: 5
arch_ref: architecture/00-README.md
index: plan.md
---

# Phase 5 — 테스트

> 공통 규약(전역 제약·구현 규약·코드 스타일)은 [plan.md](./plan.md) 참조.

- [ ] 5.1 백엔드 단위 — 폴더 사이클 방지, `owner_id` 스코프, presign 발급 권한
- [ ] 5.2 파이프라인 — 추출/OCR/청킹/임베딩 멱등·재시작, 부분 실패 격리
- [ ] 5.3 **검색 평가 게이트** — ~50 한국어 골든셋, Recall@5/@20(벡터only/하이브리드/+리랭크), 인용 존재 체크, CI 결정적 (arch 08 §11)
- [ ] 5.4 통합(E2E) — 업로드→인제스트→검색→RAG 답변→생성·계보 전 경로
- [ ] 5.5 프론트 — 핵심 플로우(트리 CRUD/이동 다이얼로그, 업/다운로드, 원본 보기, 검색, 생성) + 우측 인스펙터 토글 + presigned/CORS 동작 + **3단 반응형(다이얼로그 모바일 풀스크린)·라이트/다크 렌더 스모크**
- [ ] 5.6 재현성 검증 — provider/model/seed 기록으로 동일 생성 재실행
