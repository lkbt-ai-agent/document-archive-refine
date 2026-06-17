import type { SearchMode } from "./types";

// URL 스킴 — 루트(내 아카이브)=/my-archive, 폴더=/folders/{folderKey}, 검색=/search?q=&mode=.
// 폴더 딥링크로 특정 문서 인스펙터를 함께 열 땐 ?doc={docId}.
export const ROOT_FOLDER_ID = "root";
export const ROOT_PATH = "/my-archive";

export const folderHref = (folderId: string, docId?: string | null): string => {
  const base =
    folderId === ROOT_FOLDER_ID ? ROOT_PATH : `/folders/${folderId}`;
  return docId ? `${base}?doc=${encodeURIComponent(docId)}` : base;
};

export const searchHref = (q: string, mode: SearchMode): string =>
  `/search?q=${encodeURIComponent(q)}&mode=${mode}`;
