// 도메인 타입 (프로토타입 목업용). 실 스키마는 architecture/03 참조.

export type DocStatus = "uploaded" | "processing" | "ready" | "failed";
export type DocStage =
  | "extracting"
  | "generating_meta"
  | "chunking"
  | "embedding";

export interface Folder {
  id: string;
  parentId: string | null; // root = null
  name: string;
  createdAt?: string; // ISO — 등록일(폴더 인스펙터 표시용)
}

export interface DocumentItem {
  id: string;
  folderId: string;
  name: string;
  mime: string;
  sizeBytes: number;
  status: DocStatus;
  stage?: DocStage;
  progress?: number; // 0..100, processing 중 표시
  error?: string;
  llmTitle?: string;
  llmSummary?: string;
  topics: string[];
  keywords: string[];
  pageCount?: number;
  author?: string;
  createdAt: string; // ISO — 등록일(문서는 인앱 편집 없음, 수정일 미사용; arch 10 §10)
  ingestMs?: number; // 인제스트(추출~임베딩) 소요 ms — 성능 측정 표시용(arch 10 §11)
}

export type GenKind = "summary" | "draft" | "report";
export type GenStatus = "queued" | "running" | "succeeded" | "failed";

export interface Generation {
  id: string;
  kind: GenKind;
  status: GenStatus;
  progressPct: number;
  documentId: string; // 원본(주 source) 문서 id
  documentName: string;
  createdAt: string; // ISO
  outputDocumentId?: string; // 산출물이 materialize된 문서 id(succeeded). 문서 삭제 시 해제 → 내역 비노출
  elapsedMs?: number; // 생성 소요 ms — 성능 측정 표시용

  // 계보(lineage) — 산출물 문서 인스펙터의 계보 섹션 표시용. 실 데이터는 GET /generations/{id}/lineage (arch 09 §10).
  sourceDocumentIds?: string[]; // 부모(원본) 문서들 — 다중 원본 대비(현재 목업은 [documentId])
  model?: string; // 모델 파일/이름 스냅샷(재현성, arch 09 §8)
  provider?: string; // local | bedrock 등
  seed?: number;
  prompt?: { system: string; user: string }; // 렌더된 프롬프트 스냅샷
}

// 통합 검색 모드 — 단일 진입에서 선택(search-frontend §1). 키워드/의미=/search, rag=/search/ask.
export type SearchMode = "keyword" | "semantic" | "rag";

export interface SearchResultItem {
  documentId: string;
  documentName: string;
  title: string;
  snippet: string;
  score: number;
  chunkId: string; // 매칭 청크 id — row 아래 "청크 정보" toggle 표시용(search-frontend §3a)
  chunkIndex: number;
}

export interface Citation {
  n: number;
  chunkId: string;
  documentId: string;
  documentName: string;
  snippet: string;
}
