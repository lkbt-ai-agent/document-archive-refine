// 백엔드 응답 DTO — src/*/schemas.py 와 1:1(snake_case). 프론트 타입(lib/types.ts) 매핑은 map.ts.

import type { DocStage, DocStatus, GenKind, GenStatus } from "@/lib/types";

export interface FolderDTO {
  id: string;
  parent_id: string | null;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentDTO {
  id: string;
  folder_id: string | null;
  original_filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  sha256: string | null;
  status: DocStatus;
  stage: DocStage | null;
  error: string | null;
  page_count: number | null;
  author: string | null;
  language: string | null;
  doc_created_at: string | null;
  doc_modified_at: string | null;
  llm_title: string | null;
  llm_summary: string | null;
  topics: string[] | null;
  keywords: string[] | null;
  ingest_ms: number | null;
  created_at: string;
  updated_at: string;
}

export interface PageDTO<T> {
  items: T[];
  next_cursor: string | null;
}

export interface UploadInitResponseDTO {
  document_id: string;
  object_key: string;
  bucket: string;
  upload_url: string;
}

export interface DownloadResponseDTO {
  url: string;
}

export interface SearchResultItemDTO {
  document_id: string;
  chunk_id: string;
  score: number;
  content: string;
  original_filename: string;
  llm_title: string | null;
  folder_id: string | null;
  created_at: string;
}

export interface SearchResponseDTO {
  results: SearchResultItemDTO[];
  elapsed_ms: number;
}

export interface CitationDTO {
  n: number;
  chunk_id: string;
  document_id: string;
}

export interface AskResponseDTO {
  answer: string;
  citations: CitationDTO[];
  elapsed_ms: number;
}

export interface GenerationDTO {
  id: string;
  kind: GenKind;
  method: string | null;
  status: GenStatus;
  progress_pct: number | null;
  progress_step: string | null;
  provider: string | null;
  model_id: number | null;
  seed: number | null;
  total_tokens: number | null;
  latency_ms: number | null;
  output_text: string | null;
  output_document_id: string | null;
  error: string | null;
  created_at: string | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface ArtifactListItemDTO {
  id: string;
  kind: GenKind;
  output_document_id: string | null;
  created_at: string | null;
}

export interface SourceDocumentDTO {
  document_id: string | null;
  role: string | null;
  cited_title: string | null;
}

export interface SourceChunkDTO {
  chunk_id: string | null;
  document_id: string | null;
  citation_index: number | null;
  similarity: number | null;
  used_in_step: string | null;
  cited_text: string | null;
  cited_title: string | null;
}

export interface PromptDTO {
  step: string | null;
  step_index: number | null;
  rendered_system: string | null;
  rendered_prompt: string;
  raw_response: string | null;
}

export interface ChartDTO {
  title: string | null;
  spec_format: string | null;
  spec: Record<string, unknown>;
  data_rows: unknown;
  computed_stats: Record<string, unknown> | null;
  valid: boolean | null;
  repair_attempts: number | null;
}

export interface LineageResponseDTO {
  generation: GenerationDTO;
  source_documents: SourceDocumentDTO[];
  source_chunks: SourceChunkDTO[];
  prompts: PromptDTO[];
  charts: ChartDTO[];
}
