"use client";

import * as React from "react";
import { Folder as FolderIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useDriveStore } from "@/lib/store";
import { formatDate } from "@/lib/format";

// 폴더 인스펙터(읽기 전용) — 폴더 단일 클릭 시 우측에 표시 (arch 10 §7a, plan 1.13.2)
const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between gap-4 py-1 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="truncate text-right tabular-nums">{value}</span>
  </div>
);

export const FolderDetail = () => {
  const folderId = useDriveStore((s) => s.inspectedFolderId);
  const folder = useDriveStore((s) => s.folders.find((f) => f.id === folderId));
  const subfolderCount = useDriveStore(
    (s) => s.folders.filter((f) => f.parentId === folderId).length,
  );
  const docCount = useDriveStore(
    (s) => s.documents.filter((d) => d.folderId === folderId).length,
  );

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
        <Row label="문서" value={`${docCount}개`} />
      </div>
    </div>
  );
};
