"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, MoveRight, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FolderNameDialog } from "./folder-name-dialog";
import { MoveFolderDialog } from "./move-folder-dialog";
import { useDriveStore } from "@/lib/store";
import { useCurrentFolderId } from "@/hooks/use-current-folder";
import { folderHref, ROOT_FOLDER_ID } from "@/lib/routes";
import type { Folder } from "@/lib/types";

export type FolderAction = "move" | "rename" | "delete";

// 폴더 액션 다이얼로그(이동/이름변경/삭제)를 한 곳에서 관리하는 훅.
// Left 트리·Center 목록이 각자 인스턴스를 두고 동일 메뉴(드롭다운/우클릭)에서 onAction 을 호출한다.
export const useFolderActions = () => {
  const router = useRouter();
  const currentFolderId = useCurrentFolderId();
  const renameFolder = useDriveStore((s) => s.renameFolder);
  const deleteFolder = useDriveStore((s) => s.deleteFolder);
  const [renameTarget, setRenameTarget] = React.useState<Folder | null>(null);
  const [moveTarget, setMoveTarget] = React.useState<Folder | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Folder | null>(null);

  const onAction = React.useCallback((action: FolderAction, folder: Folder) => {
    if (action === "rename") setRenameTarget(folder);
    else if (action === "move") setMoveTarget(folder);
    else if (action === "delete") setDeleteTarget(folder);
  }, []);

  const dialogs = (
    <>
      {renameTarget && (
        <FolderNameDialog
          key={`rename-${renameTarget.id}`}
          open
          onOpenChange={(v) => !v && setRenameTarget(null)}
          title="폴더 이름 변경"
          initialName={renameTarget.name}
          submitLabel="변경"
          onSubmit={(name) => {
            renameFolder(renameTarget.id, name);
            toast.success("이름 변경 (PATCH /folders/{id} — 목업)");
          }}
        />
      )}

      <MoveFolderDialog
        folder={moveTarget}
        open={moveTarget != null}
        onOpenChange={(v) => !v && setMoveTarget(null)}
      />

      <AlertDialog
        open={deleteTarget != null}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>폴더를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTarget?.name}&quot; 및 하위 폴더·문서가 모두 삭제됩니다. 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  deleteFolder(deleteTarget.id);
                  // 현재 보던 폴더가 삭제 대상에 포함됐으면 루트로 이동
                  const stillExists = useDriveStore
                    .getState()
                    .folders.some((f) => f.id === currentFolderId);
                  if (currentFolderId && !stillExists)
                    router.push(folderHref(ROOT_FOLDER_ID));
                  toast.warning(`"${deleteTarget.name}" 삭제 (DELETE /folders/{id} — 목업)`);
                }
              }}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  return { onAction, dialogs };
};

// 폴더 "⋯" 드롭다운 버튼 (행 hover 시 노출)
export const FolderActionsMenu = ({
  folder,
  onAction,
  className,
}: {
  folder: Folder;
  onAction: (action: FolderAction, folder: Folder) => void;
  className?: string;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        className={className}
        aria-label="폴더 작업"
        onClick={(e) => e.stopPropagation()}
      >
        <MoreHorizontal className="size-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={() => onAction("move", folder)}>
        <MoveRight className="size-4" /> 이동
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onAction("rename", folder)}>
        <Pencil className="size-4" /> 이름 변경
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        variant="destructive"
        onClick={() => onAction("delete", folder)}
      >
        <Trash2 className="size-4" /> 삭제
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

// 폴더 우클릭 컨텍스트 메뉴 — "⋯"와 동일 액션
export const FolderContextMenu = ({
  folder,
  onAction,
  children,
}: {
  folder: Folder;
  onAction: (action: FolderAction, folder: Folder) => void;
  children: React.ReactNode;
}) => (
  <ContextMenu>
    <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
    <ContextMenuContent>
      <ContextMenuItem onClick={() => onAction("move", folder)}>
        <MoveRight className="size-4" /> 이동
      </ContextMenuItem>
      <ContextMenuItem onClick={() => onAction("rename", folder)}>
        <Pencil className="size-4" /> 이름 변경
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        variant="destructive"
        onClick={() => onAction("delete", folder)}
      >
        <Trash2 className="size-4" /> 삭제
      </ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>
);
