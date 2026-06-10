"use client";

import * as React from "react";
import { Search, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { dialogMobileFullscreen } from "@/lib/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { useDriveStore } from "@/lib/store";
import { mockSearchResults } from "@/lib/mock-data";

// 검색 = retrieval 결과 리스트 전용. 모드 선택 UI 없이 항상 하이브리드(RRF)로 호출한다(arch 10 §11 / 08 §6·§12).
// RAG 생성 답변은 "AI 질문"(/search/ask)으로 분리.
export const SearchDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) => {
  const query = useDriveStore((s) => s.searchQuery);
  const setQuery = useDriveStore((s) => s.setSearchQuery);
  const selectDocument = useDriveStore((s) => s.selectDocument);
  const setMobileRight = useDriveStore((s) => s.setMobileRight);

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return mockSearchResults;
    return mockSearchResults.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.snippet.toLowerCase().includes(q) ||
        r.documentName.toLowerCase().includes(q),
    );
  }, [query]);

  const open_ = (documentId: string) => {
    selectDocument(documentId);
    setMobileRight(true);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(dialogMobileFullscreen, "sm:max-w-xl")}>
        <DialogHeader>
          <DialogTitle>검색</DialogTitle>
        </DialogHeader>

        <InputGroup>
          <InputGroupAddon>
            <Search className="size-4" />
          </InputGroupAddon>
          <InputGroupInput
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="키워드 또는 자연어로 검색"
          />
        </InputGroup>

        <div className="max-h-80 space-y-1.5 overflow-y-auto">
          {results.length === 0 ? (
            <Empty className="py-8">
              <EmptyHeader>
                <EmptyTitle>결과 없음</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            results.map((r) => (
              <button
                key={r.documentId}
                type="button"
                onClick={() => open_(r.documentId)}
                className="flex w-full items-start gap-2 rounded-md border p-2.5 text-left hover:bg-accent"
              >
                <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {r.title}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {r.score.toFixed(2)}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {r.snippet}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
