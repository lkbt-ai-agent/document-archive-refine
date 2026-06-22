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

- [requirement.md](./requirement.md): 프로젝트 원본 요구사항
- [research/](./research/): 주제별 리서치 문서로, 미확정된 내용이 있을 수 있다.
- [architecture/](./architecture/): 확정된 설계 사양(source of truth)
- [plan/](./plan/): 기능별 체크리스트 구현 계획(`active/` 진행 중, `done/` 완료).
- [lessons/](./lessons/): 구현 중 겪은 실패 패턴과 재발 방지 교훈 기록.
- [glossary.md](./glossary.md): AI, RAG, 인프라 등 일반 용어 정의 모음.
