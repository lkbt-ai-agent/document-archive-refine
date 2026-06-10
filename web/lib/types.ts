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
  updatedAt: string; // ISO
}

export type GenKind = "summary" | "draft" | "report";
export type GenStatus = "queued" | "running" | "succeeded" | "failed";

export interface Generation {
  id: string;
  kind: GenKind;
  status: GenStatus;
  progressPct: number;
  documentId: string;
  documentName: string;
  createdAt: string; // ISO
}

export interface SearchResultItem {
  documentId: string;
  documentName: string;
  title: string;
  snippet: string;
  score: number;
}

export interface Citation {
  n: number;
  chunkId: string;
  documentId: string;
  documentName: string;
  snippet: string;
}
