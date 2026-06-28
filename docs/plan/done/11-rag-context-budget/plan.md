---
created: 2026-06-28
completed: 2026-06-28
overview: RAG 생성 프롬프트가 생성 서버 슬롯 컨텍스트를 넘지 않도록 컨텍스트를 토큰 예산에 맞춰 잘라 500을 없앤다.
---

> 근거: docs/lessons/open/05-rag-context-overflow-500-masked-as-cors.md(Fix 1안).
> 제약: 슬롯 하나는 입력과 출력을 합쳐 4096토큰까지 받는다. 따라서 `프롬프트 토큰 + max_tokens(출력) <= 4096`을 만족해야 한다.
> 방향: 검색 개수 k는 그대로 두고, 컨텍스트를 토큰 예산만큼만 담아 큰 청크가 와도 넘치지 않게 한다.

## A. 설정값
- [x] A1 config가 슬롯당 컨텍스트 토큰(`llama_chat_ctx_per_slot`, 기본 4096)을 정의한다.
- [x] A2 config가 RAG 출력 상한(`rag_max_tokens`, 기본 1024)과 안전 여유 토큰(`rag_ctx_margin`, 기본 256)을 정의한다.

## B. 토큰 측정
- [x] B1 ai 계층이 생성 서버 `:8080/tokenize`로 텍스트의 토큰 수를 세는 함수를 제공한다(생성 모델 기준).
- [x] B2 함수는 요청당 호출을 소수로 제한한다(라인 단위 반복 호출을 금지한다, lesson 03).

## C. 컨텍스트 예산 적용
- [x] C1 `ask`가 컨텍스트 토큰 예산을 계산한다(예산 = `llama_chat_ctx_per_slot` - `rag_max_tokens` - 시스템 토큰 - 질문 토큰 - `rag_ctx_margin`).
- [x] C2 `_build_context`가 청크를 순서대로 담되 누적 토큰이 예산을 넘으면 멈춘다.
- [x] C3 `_build_context`가 단독으로 예산을 넘는 청크를 토큰 경계에서 잘라 담는다(최소 한 청크를 보장한다).
- [x] C4 `_build_context`가 실제로 담은 청크만 인용 매핑에 남긴다(잘린 청크 번호 불일치를 막는다).

## D. 생성 호출 정합
- [x] D1 `_generate`가 `max_tokens`를 `rag_max_tokens` 설정값으로 사용해 예산 계산과 일치시킨다.
- [x] D2 `ask`가 조립된 프롬프트 토큰과 `rag_max_tokens`의 합이 슬롯 컨텍스트를 넘지 않음을 호출 전 보장한다.

## E. 검증
- [x] E1 큰 청크(표 포함)를 무는 질의가 500 없이 200으로 답함을 확인한다.
- [x] E2 여러 질의에서 프롬프트 토큰과 `rag_max_tokens`의 합이 4096 이하임을 측정으로 확인한다.
- [x] E3 답변의 인용 번호가 실제 포함된 청크와 일치함을 확인한다.
- [x] E4 기존 짧은 질의의 답 품질이 유지됨을 확인한다.

## F. 문서 반영
- [x] F1 search-and-rag(또는 search-backend) 문서가 컨텍스트 토큰 예산 규칙을 반영한다.
- [x] F2 lesson 05가 Fix 1안 적용 표기를 단다(구현 완료 후).
