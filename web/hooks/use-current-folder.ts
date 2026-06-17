"use client";

import { useParams, usePathname } from "next/navigation";
import { ROOT_FOLDER_ID } from "@/lib/routes";

// 현재 폴더 id를 URL에서 파생. 검색 화면(/search)은 폴더 컨텍스트 없음 → null.
export const useCurrentFolderId = (): string | null => {
  const params = useParams<{ folderKey?: string }>();
  const pathname = usePathname();
  if (pathname.startsWith("/search")) return null;
  return params.folderKey ?? ROOT_FOLDER_ID;
};
