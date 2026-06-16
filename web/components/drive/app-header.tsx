"use client";

import { Button } from "@/components/ui/button";
import { useDriveStore } from "@/lib/store";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { Book, PanelLeft } from "lucide-react";
import { SearchBar } from "./search-bar";
import { ThemeToggle } from "./theme-toggle";

export const AppHeader = () => {
  const setMobileLeft = useDriveStore((s) => s.setMobileLeft);
  const toggleLeftCollapsed = useDriveStore((s) => s.toggleLeftCollapsed);
  const isMobile = useIsMobile();

  // 좌측 패널 토글 — 모바일=Sheet 열기 / PC=패널 접기·펼치기
  const onToggleLeft = () => {
    if (isMobile) setMobileLeft(true);
    else toggleLeftCollapsed();
  };

  return (
    <header className="flex min-h-14 shrink-0 items-center gap-2 border-b px-3 py-1.5">
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

      {/* 통합 검색 진입 — SearchBar + 모드 드롭다운(키워드/의미/rag), 결과는 Center */}
      <SearchBar />

      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
      </div>
    </header>
  );
};
