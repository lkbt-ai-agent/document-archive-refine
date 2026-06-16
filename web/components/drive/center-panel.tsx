"use client";

import { useDriveStore } from "@/lib/store";
import { DocumentList } from "./document-list";
import { SearchResults } from "./search-results";

// Center = 조회(문서 목록) 화면 ↔ 검색 결과 화면 전환 (search-frontend §3, frontend §6·§9).
export const CenterPanel = () => {
  const searchActive = useDriveStore((s) => s.searchActive);
  return searchActive ? <SearchResults /> : <DocumentList />;
};
