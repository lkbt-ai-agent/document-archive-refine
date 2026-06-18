"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Folder as FolderIcon, FolderOpen, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FolderNameDialog } from "./folder-name-dialog";
import {
  useFolderActions,
  FolderActionsMenu,
  FolderContextMenu,
  type FolderAction,
} from "./folder-actions";
import { useDriveStore } from "@/lib/store";
import { useFolders, useCreateFolder } from "@/lib/api/folders";
import { errorMessage } from "@/lib/api/client";
import { folderHref, ROOT_FOLDER_ID } from "@/lib/routes";
import { useCurrentFolderId } from "@/hooks/use-current-folder";
import type { Folder } from "@/lib/types";

const buildChildrenMap = (folders: Folder[]) => {
  const map = new Map<string | null, Folder[]>();
  for (const f of folders) {
    const arr = map.get(f.parentId) ?? [];
    arr.push(f);
    map.set(f.parentId, arr);
  }
  return map;
};

const FolderNode = ({
  folder,
  depth,
  childrenMap,
  currentFolderId,
  onAction,
}: {
  folder: Folder;
  depth: number;
  childrenMap: Map<string | null, Folder[]>;
  currentFolderId: string | null;
  onAction: (action: FolderAction, folder: Folder) => void;
}) => {
  const router = useRouter();
  const children = childrenMap.get(folder.id) ?? [];
  const hasChildren = children.length > 0;
  const expanded = useDriveStore((s) => s.expandedFolderIds.includes(folder.id));
  const toggleFolder = useDriveStore((s) => s.toggleFolder);
  const setMobileLeft = useDriveStore((s) => s.setMobileLeft);

  const isSelected = currentFolderId === folder.id;
  // 루트("내 아카이브")는 이동/이름변경/삭제 불가 → 액션·컨텍스트 메뉴 미노출
  const isRoot = folder.parentId === null;

  const row = (
    <div
      className={cn(
        "group flex w-full items-center gap-1 rounded-md pr-1 text-sm transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        isSelected && "bg-accent text-accent-foreground font-medium",
      )}
      style={{ paddingLeft: depth * 14 + 4 }}
    >
      <button
        type="button"
        aria-label={hasChildren ? "펼치기/접기" : undefined}
        onClick={() => hasChildren && toggleFolder(folder.id)}
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded",
          !hasChildren && "invisible",
        )}
      >
        <ChevronRight
          className={cn("size-3.5 transition-transform", expanded && "rotate-90")}
        />
      </button>

      <button
        type="button"
        onClick={() => {
          router.push(folderHref(folder.id));
          setMobileLeft(false);
        }}
        className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left"
      >
        {expanded && hasChildren ? (
          <FolderOpen className="size-4 shrink-0 text-primary" />
        ) : (
          <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate">{folder.name}</span>
      </button>

      {!isRoot && (
        <FolderActionsMenu
          folder={folder}
          onAction={onAction}
          className="size-6 shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 max-md:opacity-100"
        />
      )}
    </div>
  );

  return (
    <div>
      {isRoot ? (
        row
      ) : (
        <FolderContextMenu folder={folder} onAction={onAction}>
          {row}
        </FolderContextMenu>
      )}

      {expanded &&
        children.map((c) => (
          <FolderNode
            key={c.id}
            folder={c}
            depth={depth + 1}
            childrenMap={childrenMap}
            currentFolderId={currentFolderId}
            onAction={onAction}
          />
        ))}
    </div>
  );
};

export const FolderTree = () => {
  const { data: folders = [] } = useFolders();
  const createFolder = useCreateFolder();
  const expandFolder = useDriveStore((s) => s.expandFolder);
  const currentFolderId = useCurrentFolderId();
  // 새 폴더 부모 = 현재 폴더(검색 화면이면 루트)
  const newParentId = currentFolderId ?? ROOT_FOLDER_ID;

  const childrenMap = React.useMemo(() => buildChildrenMap(folders), [folders]);
  const roots = childrenMap.get(null) ?? [];

  const { onAction, dialogs } = useFolderActions();
  const [newOpen, setNewOpen] = React.useState(false);

  const newParentName =
    folders.find((f) => f.id === newParentId)?.name ?? "내 아카이브";

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
          onClick={() => setNewOpen(true)}
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
            currentFolderId={currentFolderId}
            onAction={onAction}
          />
        ))}
      </ScrollArea>

      {/* 새 폴더 — 현재 선택 폴더 하위에 생성 */}
      {newOpen && (
        <FolderNameDialog
          key="new"
          open={newOpen}
          onOpenChange={setNewOpen}
          title="새 폴더"
          description={`"${newParentName}" 하위에 폴더를 만듭니다.`}
          initialName=""
          submitLabel="만들기"
          onSubmit={(name) =>
            createFolder.mutate(
              { parentId: newParentId, name },
              {
                onSuccess: () => {
                  expandFolder(newParentId);
                  toast.success(`"${name}" 폴더를 만들었습니다.`);
                },
                onError: (e) => toast.error(errorMessage(e)),
              },
            )
          }
        />
      )}

      {/* 이동/이름변경/삭제 다이얼로그(공용) */}
      {dialogs}
    </div>
  );
};
