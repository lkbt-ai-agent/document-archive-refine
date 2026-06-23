# document-archive-refine

문서를 업로드하면 AI가 읽고 이해해 검색·RAG·요약/초안/보고서를 제공하는 한국어 문서 아카이브 웹앱 프로젝트

## 주요 디렉토리

### 모듈 소스코드

- [web/](./web/): Next.js 프론트엔드
- [backend/](./backend/): 백엔드 API·워커
- [crawler/](./crawler/): 테스트용 실데이터 수집기(SH·LH 청약 모집공고 PDF). `test-data-crawler` 스킬로 실행.
- [scripts/](./scripts/): 로컬 운영 스크립트
- [docker-compose.yml](./docker-compose.yml): Redis·앱 컨테이너 구성.

### 문서

- [docs/](./docs/): 요구사항·리서치·설계·계획·교훈 문서 묶음.
- [docs/requirement.md](./docs/requirement.md): 프로젝트 원본 요구사항
- [docs/research/](./docs/research/): 주제별 리서치 문서로, 미확정된 내용이 있을 수 있다.
- [docs/architecture/](./docs/architecture/): 확정된 설계 사양(source of truth)
- [docs/plan/](./docs/plan/): 기능별 체크리스트 구현 계획(`active/` 진행 중, `done/` 완료).
- [docs/lessons/](./docs/lessons/): 구현 중 겪은 실패 패턴과 재발 방지 교훈 기록.
- [docs/glossary.md](./docs/glossary.md): AI, RAG, 인프라 등 일반 용어 정의 모음.
- [docs/todo.md](./docs/todo.md): 기록 추적 없이 로컬에서 쓰는 비공식 아이디어·todo 메모.
