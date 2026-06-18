// react-query 쿼리 키 — 도메인 간 무효화 일관성을 위해 한 곳에서 관리.
import type { SearchMode } from "@/lib/types";

export const qk = {
  folders: ["folders"] as const,
  documents: (folderId: string) => ["documents", folderId] as const,
  document: (id: string) => ["document", id] as const,
  search: (mode: SearchMode, q: string) => ["search", mode, q] as const,
  artifacts: (sourceDocumentId: string) =>
    ["generations", "by-source", sourceDocumentId] as const,
  allArtifacts: ["generations", "all"] as const,
  generation: (id: string) => ["generation", id] as const,
  lineage: (id: string) => ["lineage", id] as const,
};
