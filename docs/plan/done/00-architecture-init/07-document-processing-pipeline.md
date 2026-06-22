---
created: 2026-06-10
completed: 2026-06-10
overview: docs/architecture/07 작성 플랜 — 추출→메타→청킹→임베딩 비동기 인제스트 파이프라인(완료).
---

## 작성 단계
- [x] S1 파이프라인 개요(status/stage, 멱등·재시작).
- [x] S2 파일 타입 감지(magic bytes).
- [x] S3 PDF 추출(pypdf + pdfplumber 표).
- [x] S4 OCR(PaddleOCR → Tesseract kor → 선택 Qwen2.5-VL).
- [x] S5 TXT/MD(인코딩 감지, MD 구조 보존).
- [x] S6 메타 생성(intrinsic + NLP + LLM).
- [x] S7 청킹(512/64, 표 직렬화).
- [x] S8 임베딩 & 저장(KURE-v1 1024d, 멱등 upsert).
- [x] S9 오케스트레이션(arq, 폴링, 부분 실패 격리).
