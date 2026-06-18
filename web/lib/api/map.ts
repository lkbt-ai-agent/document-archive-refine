// DTO(snake_case) → 프론트 도메인 타입(camelCase) 매핑.
// 백엔드엔 단일 루트 폴더 행이 없다(최상위 = folder_id/parent_id NULL). 프론트는 가상 루트
// "내 아카이브"(id=ROOT_FOLDER_ID)를 합성하고 NULL 부모를 그 아래로 모아 트리를 단일 루트로 만든다.

import { ROOT_FOLDER_ID } from "@/lib/routes";
import type {
  Citation,
  DocumentItem,
  Folder,
  Generation,
  Lineage,
  SearchResultItem,
} from "@/lib/types";
import type {
  AskResponseDTO,
  CitationDTO,
  DocumentDTO,
  FolderDTO,
  GenerationDTO,
  LineageResponseDTO,
  SearchResultItemDTO,
} from "./dto";

const VIRTUAL_ROOT: Folder = {
  id: ROOT_FOLDER_ID,
  parentId: null,
  name: "내 아카이브",
};

export const mapFolders = (dtos: FolderDTO[]): Folder[] => [
  VIRTUAL_ROOT,
  ...dtos.map((f) => ({
    id: f.id,
    parentId: f.parent_id ?? ROOT_FOLDER_ID,
    name: f.name,
    createdAt: f.created_at,
  })),
];

export const mapDocument = (d: DocumentDTO): DocumentItem => ({
  id: d.id,
  folderId: d.folder_id ?? ROOT_FOLDER_ID,
  name: d.original_filename,
  mime: d.mime_type ?? "application/octet-stream",
  sizeBytes: d.size_bytes ?? 0,
  status: d.status,
  stage: d.stage ?? undefined,
  error: d.error ?? undefined,
  llmTitle: d.llm_title ?? undefined,
  llmSummary: d.llm_summary ?? undefined,
  topics: d.topics ?? [],
  keywords: d.keywords ?? [],
  pageCount: d.page_count ?? undefined,
  author: d.author ?? undefined,
  createdAt: d.created_at,
  ingestMs: d.ingest_ms ?? undefined,
});

export const mapSearchResult = (r: SearchResultItemDTO): SearchResultItem => ({
  documentId: r.document_id,
  chunkId: r.chunk_id,
  score: r.score,
  snippet: r.content,
  documentName: r.original_filename,
  title: r.llm_title ?? r.original_filename,
  folderId: r.folder_id ?? ROOT_FOLDER_ID,
});

export const mapCitation = (c: CitationDTO): Citation => ({
  n: c.n,
  chunkId: c.chunk_id,
  documentId: c.document_id,
});

export const mapAskCitations = (res: AskResponseDTO): Citation[] =>
  res.citations.map(mapCitation);

// 진행 중 생성 추적용(GenerationPanel) — 원본 문서 정보는 호출부가 이미 안다.
export const mapGeneration = (g: GenerationDTO): Generation => ({
  id: g.id,
  kind: g.kind,
  status: g.status,
  progressPct: g.progress_pct ?? 0,
  documentId: "",
  documentName: "",
  createdAt: g.created_at ?? "",
  outputDocumentId: g.output_document_id ?? undefined,
  elapsedMs: g.latency_ms ?? undefined,
});

export const mapLineage = (l: LineageResponseDTO): Lineage => ({
  generationId: l.generation.id,
  kind: l.generation.kind,
  provider: l.generation.provider ?? undefined,
  model: l.generation.model_id != null ? `#${l.generation.model_id}` : undefined,
  seed: l.generation.seed ?? undefined,
  latencyMs: l.generation.latency_ms ?? undefined,
  createdAt: l.generation.created_at ?? undefined,
  sourceDocuments: l.source_documents.map((s) => ({
    documentId: s.document_id,
    role: s.role ?? undefined,
    citedTitle: s.cited_title ?? undefined,
  })),
  prompts: l.prompts.map((p) => ({
    step: p.step ?? undefined,
    system: p.rendered_system ?? undefined,
    prompt: p.rendered_prompt,
  })),
  charts: l.charts.map((c) => ({ title: c.title ?? undefined, spec: c.spec })),
});
