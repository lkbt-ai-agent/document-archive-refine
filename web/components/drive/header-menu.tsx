"use client";

import {
  MoreHorizontal,
  Upload,
  FolderPlus,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useArchiveActions } from "@/hooks/use-archive-actions";
import { useCurrentFolderId } from "@/hooks/use-current-folder";
import { ROOT_FOLDER_ID } from "@/lib/routes";

// 헤더 우측 "⋯" 통합 액션 메뉴 — 파일 추가 / 폴더 추가 / 테마 (PC·모바일 동일, frontend.md §10).
export const HeaderMenu = () => {
  const { setTheme } = useTheme();
  const folderId = useCurrentFolderId() ?? ROOT_FOLDER_ID;
  const { openFilePicker, openNewFolder, elements } =
    useArchiveActions(folderId);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="메뉴">
            <MoreHorizontal className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={openFilePicker}>
            <Upload className="size-4" /> 파일 추가
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={openNewFolder}>
            <FolderPlus className="size-4" /> 폴더 추가
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Sun className="size-4 dark:hidden" />
              <Moon className="hidden size-4 dark:block" />
              테마
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => setTheme("light")}>
                <Sun className="size-4" /> 라이트
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>
                <Moon className="size-4" /> 다크
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")}>
                <Monitor className="size-4" /> 시스템
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>

      {elements}
    </>
  );
};
