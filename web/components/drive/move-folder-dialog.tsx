"use client";

import * as React from "react";
import { Folder as FolderIcon, FolderOpen, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { dialogMobileFullscreen } from "@/lib/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useFolders, useMoveFolder } from "@/lib/api/folders";
import { errorMessage } from "@/lib/api/client";
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

// 자기 자신 + 후손 id (이동 대상에서 비활성화 — 사이클 방지, arch 05 §6)
const subtreeIds = (folders: Folder[], rootId: string): Set<string> => {
  const childrenMap = buildChildrenMap(folders);
  const ids = new Set<string>();
  const walk = (id: string) => {
    ids.add(id);
    for (const c of childrenMap.get(id) ?? []) walk(c.id);
  };
  walk(rootId);
  return ids;
};

// 폴더 이동: 트리 구조를 표현하고 옮길 대상 상위 폴더를 선택 (arch 10 §8a).
export const MoveFolderDialog = ({
  folder,
  open,
  onOpenChange,
}: {
  folder: Folder | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) => {
  const { data: folders = [] } = useFolders();
  const moveFolder = useMoveFolder();
  const [target, setTarget] = React.useState<string | null>(null);

  const childrenMap = React.useMemo(() => buildChildrenMap(folders), [folders]);
  const disabled = React.useMemo(
    () => (folder ? subtreeIds(folders, folder.id) : new Set<string>()),
    [folders, folder],
  );
  const roots = childrenMap.get(null) ?? [];

  const submit = () => {
    if (!folder || !target) return;
    moveFolder.mutate(
      { id: folder.id, parentId: target },
      {
        onSuccess: () => toast.success("폴더를 이동했습니다."),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
    onOpenChange(false);
  };

  const renderNode = (f: Folder, depth: number) => {
    const blocked = disabled.has(f.id);
    const isCurrentParent = folder?.parentId === f.id;
    const selected = target === f.id;
    const kids = childrenMap.get(f.id) ?? [];
    return (
      <div key={f.id}>
        <button
          type="button"
          disabled={blocked}
          onClick={() => setTarget(f.id)}
          className={cn(
            "flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-sm transition-colors",
            blocked
              ? "cursor-not-allowed text-muted-foreground/50"
              : "hover:bg-accent",
            selected && "bg-accent font-medium",
          )}
          style={{ paddingLeft: depth * 16 + 8 }}
        >
          {kids.length > 0 ? (
            <FolderOpen className="size-4 shrink-0 text-primary" />
          ) : (
            <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate">{f.name}</span>
          {isCurrentParent && (
            <span className="ml-1 text-[10px] text-muted-foreground">(현재 위치)</span>
          )}
          {selected && <Check className="ml-auto size-4 text-primary" />}
        </button>
        {kids.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(dialogMobileFullscreen, "sm:max-w-md")}>
        <DialogHeader>
          <DialogTitle>폴더 이동</DialogTitle>
          <DialogDescription className="truncate">
            &quot;{folder?.name}&quot; 을(를) 옮길 상위 폴더를 선택하세요.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-64 rounded-md border p-1 max-md:h-[calc(100dvh-12rem)]">
          {roots.map((r) => renderNode(r, 0))}
        </ScrollArea>

        <DialogFooter showCloseButton>
          <Button onClick={submit} disabled={!target}>
            여기로 이동
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
