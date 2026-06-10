"use client";

import * as React from "react";
import {
  ChevronRight,
  Folder as FolderIcon,
  FolderOpen,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { mockFolders } from "@/lib/mock-data";
import { useDriveStore } from "@/lib/store";
import type { Folder } from "@/lib/types";

function buildChildrenMap(folders: Folder[]) {
  const map = new Map<string | null, Folder[]>();
  for (const f of folders) {
    const arr = map.get(f.parentId) ?? [];
    arr.push(f);
    map.set(f.parentId, arr);
  }
  return map;
}

function FolderNode({
  folder,
  depth,
  childrenMap,
}: {
  folder: Folder;
  depth: number;
  childrenMap: Map<string | null, Folder[]>;
}) {
  const children = childrenMap.get(folder.id) ?? [];
  const hasChildren = children.length > 0;
  const selectedFolderId = useDriveStore((s) => s.selectedFolderId);
  const expanded = useDriveStore((s) => s.expandedFolderIds.includes(folder.id));
  const selectFolder = useDriveStore((s) => s.selectFolder);
  const toggleFolder = useDriveStore((s) => s.toggleFolder);
  const setMobileLeft = useDriveStore((s) => s.setMobileLeft);

  const isSelected = selectedFolderId === folder.id;

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            type="button"
            onClick={() => {
              selectFolder(folder.id);
              setMobileLeft(false);
            }}
            className={cn(
              "group flex w-full items-center gap-1 rounded-md py-1.5 pr-2 text-sm transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              isSelected && "bg-accent text-accent-foreground font-medium",
            )}
            style={{ paddingLeft: depth * 14 + 4 }}
          >
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                if (hasChildren) toggleFolder(folder.id);
              }}
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded",
                !hasChildren && "invisible",
              )}
            >
              <ChevronRight
                className={cn(
                  "size-3.5 transition-transform",
                  expanded && "rotate-90",
                )}
              />
            </span>
            {expanded && hasChildren ? (
              <FolderOpen className="size-4 shrink-0 text-primary" />
            ) : (
              <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate">{folder.name}</span>
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => toast.info("새 하위 폴더 (목업)")}>
            <Plus className="size-4" /> 새 하위 폴더
          </ContextMenuItem>
          <ContextMenuItem onClick={() => toast.info("이름 변경 (목업)")}>
            <Pencil className="size-4" /> 이름 변경
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            variant="destructive"
            onClick={() => toast.warning("폴더 재귀 삭제 (목업)")}
          >
            <Trash2 className="size-4" /> 삭제
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {expanded &&
        children.map((c) => (
          <FolderNode
            key={c.id}
            folder={c}
            depth={depth + 1}
            childrenMap={childrenMap}
          />
        ))}
    </div>
  );
}

export function FolderTree() {
  // 평면 리스트 → 트리 구성 (arch 05 §5 / 10 §7: useMemo)
  const childrenMap = React.useMemo(() => buildChildrenMap(mockFolders), []);
  const roots = childrenMap.get(null) ?? [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          폴더
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="새 폴더"
          onClick={() => toast.info("새 폴더 (목업)")}
        >
          <Plus className="size-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1 px-2 pb-2">
        {roots.map((r) => (
          <FolderNode
            key={r.id}
            folder={r}
            depth={0}
            childrenMap={childrenMap}
          />
        ))}
      </ScrollArea>
    </div>
  );
}
