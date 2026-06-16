"use client";

import * as React from "react";
import { Search, ChevronDown, Type, Brain, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDriveStore } from "@/lib/store";
import type { SearchMode } from "@/lib/types";

// 통합 검색 진입(search-frontend §1·§2) — SearchBar(textarea) + "검색..." 모드 드롭다운.
// Enter = 모드 드롭다운 트리거, Shift+Enter = 줄바꿈. 모드 선택 시 현재 입력값으로 실행.
const MODES: {
  mode: SearchMode;
  label: string;
  icon: React.ElementType;
  desc: string;
}[] = [
  { mode: "keyword", label: "키워드", icon: Type, desc: "PGroonga 정확 매칭" },
  { mode: "semantic", label: "의미", icon: Brain, desc: "임베딩 벡터 유사도 (기본)" },
  { mode: "rag", label: "rag", icon: Sparkles, desc: "인용과 함께 답변 생성" },
];

export const SearchBar = () => {
  const query = useDriveStore((s) => s.searchQuery);
  const setQuery = useDriveStore((s) => s.setSearchQuery);
  const runSearch = useDriveStore((s) => s.runSearch);
  const [menuOpen, setMenuOpen] = React.useState(false);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter = 모드 선택 드롭다운 열기, Shift+Enter = 줄바꿈(기본 동작)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (query.trim()) setMenuOpen(true);
    }
  };

  const pick = (mode: SearchMode) => {
    setMenuOpen(false);
    if (query.trim()) runSearch(mode);
  };

  return (
    <div className="ml-2 flex max-w-xl flex-1 items-center gap-1.5">
      {/* 고정 높이(h-9) 래퍼 — textarea 는 absolute 오버레이로 아래로 확장해 헤더 높이 불변 */}
      <div className="relative h-9 flex-1">
        {/* stepped auto-grow: field-sizing-content 로 줄 수만큼 단계 증가, 최대 높이 후 스크롤 */}
        <Textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder="검색 (Enter=모드 선택 · Shift+Enter=줄바꿈)"
          className="absolute inset-x-0 top-0 z-20 max-h-40 min-h-9 resize-none overflow-y-auto bg-background py-1.5 text-sm shadow-sm"
        />
      </div>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 shrink-0">
            <Search className="size-4" />
            <span className="hidden sm:inline">검색...</span>
            <ChevronDown className="size-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>검색 모드</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {MODES.map((m) => {
            const Icon = m.icon;
            return (
              <DropdownMenuItem
                key={m.mode}
                disabled={!query.trim()}
                onClick={() => pick(m.mode)}
              >
                <Icon className="size-4" />
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium">{m.label}</span>
                  <span className="text-xs text-muted-foreground">{m.desc}</span>
                </div>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
