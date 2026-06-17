"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronDown, Type, Brain, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
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
import { useIsMobile } from "@/hooks/use-is-mobile";
import { searchHref } from "@/lib/routes";
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

export const SearchBar = ({
  onFocusChange,
}: {
  onFocusChange?: (focused: boolean) => void;
}) => {
  const router = useRouter();
  const query = useDriveStore((s) => s.searchQuery);
  const setQuery = useDriveStore((s) => s.setSearchQuery);
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [focused, setFocused] = React.useState(false);

  // 모바일 전용 — 포커스 시 헤더 전체 폭 차지, 포커스 아웃 시 한 줄로 접힘
  const fullWidth = isMobile && focused;
  const collapsed = isMobile && !focused;

  const onFocus = () => {
    setFocused(true);
    onFocusChange?.(true);
  };
  const onBlur = () => {
    setFocused(false);
    onFocusChange?.(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 한글 IME 조합 중 Enter는 조합 확정용이므로 무시(무시 안 하면 마지막 글자 중복: "연봉"→"연봉봉")
    if (e.nativeEvent.isComposing) return;
    // Enter = 모드 선택 드롭다운 열기, Shift+Enter = 줄바꿈(기본 동작)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (query.trim()) setMenuOpen(true);
    }
  };

  const pick = (mode: SearchMode) => {
    setMenuOpen(false);
    if (query.trim()) router.push(searchHref(query, mode));
  };

  return (
    <div
      className={cn(
        "flex w-full items-center gap-1.5",
        !fullWidth && "max-w-xl",
      )}
    >
      {/* 고정 높이(h-9) 래퍼 — textarea 는 absolute 오버레이로 아래로 확장해 헤더 높이 불변 */}
      <div className="relative h-9 flex-1">
        {/* 포커스 시 줄 수만큼 확장(최대 높이 후 스크롤), 모바일 blur 시 한 줄로 접힘 */}
        <Textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          onBlur={onBlur}
          rows={1}
          placeholder="검색"
          style={
            collapsed
              ? ({ fieldSizing: "fixed" } as unknown as React.CSSProperties)
              : undefined
          }
          className={cn(
            "absolute inset-x-0 top-0 z-20 min-h-9 resize-none bg-background py-1.5 text-sm shadow-sm",
            collapsed ? "h-9 overflow-hidden" : "max-h-40 overflow-y-auto",
          )}
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
