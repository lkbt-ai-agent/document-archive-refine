# Document Archive AI — 아키텍처 설계 문서

`research/`의 세부 설계를 바탕으로 작성한 아키텍처 문서 모음.
**핵심 인프라 제약:** PostgreSQL·MinIO는 원격(`49.247.14.186`)에 이미 배포됨 → 연결만 하고 로컬 중복 정의 금지.

## 문서 색인
| # | 문서 | 내용 |
|---|---|---|
| 01 | [system-overview](./01-system-overview.md) | 컨텍스트·컴포넌트·배포 토폴로지·기술 스택 |
| 02 | [infrastructure-and-environment](./02-infrastructure-and-environment.md) | 원격 PG/MinIO 연결, 환경변수, Redis·llama 런타임, 확장 검증 |
| 03 | [data-model-and-migrations](./03-data-model-and-migrations.md) | 전체 스키마(폴더·문서·청크·계보), Alembic |
| 04 | [backend-application](./04-backend-application.md) | FastAPI 도메인 모듈, async SA2, Provider 추상화 |
| 05 | [folder-management](./05-folder-management.md) | 인접 리스트 폴더 트리 CRUD·MOVE |
| 06 | [document-storage](./06-document-storage.md) | 원격 MinIO presigned 업/다운로드 |
| 07 | [document-processing-pipeline](./07-document-processing-pipeline.md) | 추출·OCR·메타·청킹·임베딩(arq) |
| 08 | [search-and-rag](./08-search-and-rag.md) | PGroonga+pgvector 하이브리드, RAG |
| 09 | [ai-outputs-and-lineage](./09-ai-outputs-and-lineage.md) | 요약/초안/보고서, 계보 |
| 10 | [frontend-drive-ui](./10-frontend-drive-ui.md) | Next.js 3-Panel UI |

## TL;DR 결정표
| 항목 | 결정 |
|---|---|
| 인프라 | **PostgreSQL·MinIO 원격 고정**(연결만), Redis 별도 provisioning |
| DB 드라이버 | psycopg3 async(`postgresql+psycopg`, .env 기준), 전용 스키마 `archive` |
| 확장 | pgvector + PGroonga(배포 전 가용성·권한 검증 필수) |
| 생성 LLM | A.X 4.0 Light 7B (llama.cpp, **개발자 Mac mini 네이티브 Metal**) |
| 임베딩 | KURE-v1 1024d(로컬 고정) |
| OCR | PaddleOCR+Tesseract+(선택)Qwen2.5-VL |
| PDF 추출 | pypdf(BSD)+pdfplumber(MIT), PyMuPDF 제외(AGPL) |
| 검색 | PGroonga TokenBigram + pgvector HNSW, RRF k=50 |
| 폴더 트리 | 인접 리스트 + 재귀 CTE |
| 스토리지 | 원격 MinIO presigned, key `docs/{uuid}` |
| 비동기 | arq + Redis |
| 계보 | `generations` 헤드 + 하위, 행 스냅샷 |
| 프론트 | Next.js RSC 셸 + Client 패널, react-query + Zustand, shadcn/Tailwind |

## 근거
세부 비교·벤치마크는 [`research/`](../research/) 참조. 용어는 [`research/06-glossary.md`](../research/06-glossary.md).
