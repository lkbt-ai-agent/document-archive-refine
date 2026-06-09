# Document Archive AI
## 프로젝트 개요
- 개인 문서를 저장, 분류, 검색하고 로컬 AI를 활용하여 2차 산출물을 생성하는 반응형 웹 애플리케이션.
- 사용자는 PDF, 텍스트, 이미지 문서를 업로드할 수 있고, 시스템은 자동으로 텍스트 추출, 메타데이터 생성, 임베딩을 수행한다.
- 사용자는 키워드 검색, 의미 검색, RAG 기반 질의응답을 통해 문서를 탐색할 수 있다.
- 사용자는 AI를 이용해 요약 및 초안을 생성할 수 있다.
- 본 프로젝트는 로컬 AI 환경(llama.cpp)을 중심으로 동작하는 MVP 구현을 목표로 한다.
---
# 개발 기간
- 개발 기간: 2주
- 목표 일정: 6월 말 Preview Release
---
# 기능
## 레이아웃
- Google Drive 스타일 반응형 UI
- Header Search Bar
  - 일반적인 키워드 검색
  - 자연어 검색 (예: "작년 내 연봉이 얼마였지?" -> 작년 연봉 계약서 문서를 찾아 해당 내용을 기반으로 답변)
- 3-Panel Layout
### Left Panel
- 계층형 폴더 트리
- 폴더 생성
- 폴더 이름 변경
- 폴더 이동
- 폴더 삭제
### Center Panel
- 문서 목록
- 문서 상세 조회
- 문서 업로드
- 문서 다운로드
- 문서 삭제
- 문서 이동
- 폴더 등록
- 폴더 이름 수정
- 폴더 이동
- 폴더 삭제
### Right Panel
- 선택한 폴더 메타데이터
- 선택한 문서 메타데이터
- AI 생성 이력 요약
---
## 문서 처리
### 지원 형식
- PDF 확장자: PDF
- 텍스트 확장자: TXT, MD
- 이미지 확장자: PNG, JPG, JPEG, WEBP
### 텍스트 추출
- TODO: 각 타입별 추출 방식 결정 필요
### 메타데이터 생성
- TODO: 메타데이터 생성 방식과 어떤 메타데이터를 저장할지 결정 필요
### 임베딩
- TODO: 임베딩 방식과 어떤 데이터를 임베딩할지 결정 필요
---
## 검색
- TODO: 일반적인 키워드 검색, 자연어 검색을 설계하고 구현 방식을 결정해야 함
- TODO: 특히 자연어 검색의 경우 AI 모델과 임베딩을 어떻게 활용할지가 중요
---
## AI 산출물
### Summary
- 문서 요약 생성
- TODO: 상세한 워크플로우 구축 필요
### Draft
- 문서 기반 초안 생성
- TODO: 상세한 워크플로우 구축 필요
### Report
- 문서를 분석하고 필요할 경우 통계 그래프를 그린 보고서 생성
- TODO: 상세한 워크플로우 구축 필요
---
## 계보(Lineage)
AI 산출물에 대해 다음 정보를 저장한다.
- 출처 문서
- 출처 청크
- 프롬프트
- 모델
- Provider
- 파라미터
- 생성 시각
- TODO: 그 외 계보성 메타데이터 설계 필요
---

# 개발 스펙
## Frontend
- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- shadcn/ui
- Lucide React
## Backend
- FastAPI
- Pydantic v2
- SQLAlchemy v2
- Alembic
## Database
- PostgreSQL
- pgvector
## Storage
- MinIO
## AI Runtime
- llama.cpp

## Models
### OCR
- TODO: OCR 모델 결정 필요
### Embedding
- TODO: Embedding 모델 결정 필요
### Generation
- TODO: Generation 모델 결정 필요
---
# Preview Release 범위

다음 기능이 정상 동작하면 Preview 완료로 판단한다.

- 폴더 CRUD
- 문서 업로드
- 텍스트 추출
- 메타데이터 생성
- 임베딩 생성
- 키워드 검색
- 의미 검색
- RAG 답변
- 문서 요약
- 문서 초안 생성
- 출처 추적
- 반응형 UI
