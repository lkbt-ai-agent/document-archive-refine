"use client";

import * as React from "react";
import { Search, Sparkles, PanelLeft, FolderTree as FolderTreeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";
import { SearchDialog } from "./search-dialog";
import { AskDialog } from "./ask-dialog";
import { useDriveStore } from "@/lib/store";

export function AppHeader() {
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [askOpen, setAskOpen] = React.useState(false);
  const setMobileLeft = useDriveStore((s) => s.setMobileLeft);

  // ⌘K / Ctrl-K 로 검색 열기
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-3">
      {/* 모바일: 폴더 트리 Sheet 트리거 */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="폴더 열기"
        onClick={() => setMobileLeft(true)}
      >
        <PanelLeft className="size-5" />
      </Button>

      <div className="flex items-center gap-2 font-semibold">
        <FolderTreeIcon className="size-5 text-primary" />
        <span className="hidden sm:inline">문서 보관함</span>
      </div>

      {/* 검색 트리거 (가짜 입력 → 다이얼로그) */}
      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        className="ml-2 flex h-9 flex-1 items-center gap-2 rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted max-w-md"
      >
        <Search className="size-4" />
        <span className="truncate">문서 검색…</span>
        <kbd className="ml-auto hidden rounded border bg-background px-1.5 py-0.5 text-[10px] sm:inline">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1">
        <Button variant="outline" size="sm" onClick={() => setAskOpen(true)}>
          <Sparkles className="size-4" />
          <span className="hidden sm:inline">AI 질문</span>
        </Button>
        <ThemeToggle />
      </div>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      <AskDialog open={askOpen} onOpenChange={setAskOpen} />
    </header>
  );
}
