// react-query 쿼리 키 — 도메인 간 무효화 일관성을 위해 한 곳에서 관리.
import type { ListSort, SearchMode } from "@/lib/types";

export const qk = {
  folders: ["folders"] as const,
  // 정렬별로 캐시·커서가 갈리므로 sort를 키에 포함한다(document-backend §1).
  documents: (folderId: string, sort: ListSort) =>
    ["documents", folderId, sort] as const,
  // 폴더 단위 프리픽스 — 정렬별 변형을 한꺼번에 무효화/낙관 갱신할 때 쓴다.
  documentsByFolder: (folderId: string) => ["documents", folderId] as const,
  document: (id: string) => ["document", id] as const,
  search: (mode: SearchMode, q: string) => ["search", mode, q] as const,
  artifacts: (sourceDocumentId: string) =>
    ["generations", "by-source", sourceDocumentId] as const,
  allArtifacts: ["generations", "all"] as const,
  generation: (id: string) => ["generation", id] as const,
  lineage: (id: string) => ["lineage", id] as const,
};
