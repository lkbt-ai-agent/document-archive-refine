"use client";

import { Folder as FolderIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useDriveStore } from "@/lib/store";
import { useFolders } from "@/lib/api/folders";
import { useDocuments } from "@/lib/api/documents";
import { formatDate } from "@/lib/format";
import { DEFAULT_LIST_SORT } from "@/lib/types";

// 폴더 인스펙터(읽기 전용) — 폴더 단일/눈 클릭 시 우측에 표시 (folders-frontend §1).
const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between gap-4 py-1 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="truncate text-right tabular-nums">{value}</span>
  </div>
);

export const FolderDetail = () => {
  const folderId = useDriveStore((s) => s.inspectedFolderId);
  const { data: folders = [] } = useFolders();
  const folder = folders.find((f) => f.id === folderId);
  const subfolderCount = folders.filter((f) => f.parentId === folderId).length;

  const docsQuery = useDocuments(folderId ?? "none", DEFAULT_LIST_SORT, !!folderId);
  const loadedDocs =
    (docsQuery.data?.pages ?? []).reduce((n, p) => n + p.items.length, 0) ?? 0;
  // 정확한 총계 API가 없어 로드된 건수 기준(다음 페이지 있으면 "+").
  const docLabel = `${loadedDocs}${docsQuery.hasNextPage ? "+" : ""}개`;

  if (!folder) return null;

  return (
    <div className="space-y-4 p-4">
      <div className="flex min-w-0 items-center gap-2">
        <FolderIcon className="size-5 shrink-0 text-primary" />
        <h3 className="truncate font-semibold">{folder.name}</h3>
      </div>

      <Separator />

      <div>
        <Row
          label="등록일"
          value={folder.createdAt ? formatDate(folder.createdAt) : "—"}
        />
        <Row label="하위 폴더" value={`${subfolderCount}개`} />
        <Row label="문서" value={docLabel} />
      </div>
    </div>
  );
};
