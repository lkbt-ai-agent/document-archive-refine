# TODO

- 파일/폴더 목록의 정렬 필터 값을 개인화 설정으로 보존하기 (local storage 혹은 DB)
- 검색 시 파일명도 검색 대상에 포함할지 결정 (research/01-mvp-research/09-search-filename-scope.md 참조)
- 문서 업로드 실패 시 상태별 retry 정책 구현 (research/01-mvp-research/08-failed-document-retry.md 참조)
- 백엔드 로깅 정책 확정 (research/01-mvp-research/07-backend-logging-libraries.md 참조)
- 모델 및 모듈 일부를 AWS 등으로 이관하는 방안 고려 (research/01-mvp-research/10-aws-offload-architecture.md 참조)
- 반프로세스 테스트 (업로드 중 문서가 있을 때 문서 삭제 혹은 폴더 삭제, 업로드 중 문서가 있을 때 상위 폴더 이동 등)
- 문서 적재 시 RAG 검색(자연어 검색 + LLM loop)의 모수 데이터로 쓸 마크다운 요약본(.md)을 비동기로 별도 적재 (예: 중요한 날짜, 단계, 장소, 인명, 주제어 기록)
- 적재용 생성형 LLM과 검색 질의용 LLM은 분리하여 설계
