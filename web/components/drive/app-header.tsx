"use client";

import { Button } from "@/components/ui/button";
import { useDriveStore } from "@/lib/store";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { Book, PanelLeft, Search, Sparkles } from "lucide-react";
import * as React from "react";
import { AskDialog } from "./ask-dialog";
import { SearchDialog } from "./search-dialog";
import { ThemeToggle } from "./theme-toggle";

export const AppHeader = () => {
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [askOpen, setAskOpen] = React.useState(false);
  const setMobileLeft = useDriveStore((s) => s.setMobileLeft);
  const toggleLeftCollapsed = useDriveStore((s) => s.toggleLeftCollapsed);
  const isMobile = useIsMobile();

  // 좌측 패널 토글 — 모바일=Sheet 열기 / PC=패널 접기·펼치기
  const onToggleLeft = () => {
    if (isMobile) setMobileLeft(true);
    else toggleLeftCollapsed();
  };

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
      {/* 폴더 패널 토글 — 모바일=Sheet / PC=접기·펼치기 */}
      <Button
        variant="ghost"
        size="icon"
        aria-label="폴더 패널 토글"
        onClick={onToggleLeft}
      >
        <PanelLeft className="size-5" />
      </Button>

      <div className="flex items-center gap-2 font-semibold">
        <Book className="size-5 text-primary" />
        <span className="hidden sm:inline">Mechive</span>
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
          <span className="hidden sm:inline">RAG 질문</span>
        </Button>
        <ThemeToggle />
      </div>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      <AskDialog open={askOpen} onOpenChange={setAskOpen} />
    </header>
  );
};
