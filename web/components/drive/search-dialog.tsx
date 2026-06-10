"use client";

import * as React from "react";
import { Search, FileText } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { useDriveStore } from "@/lib/store";
import { mockSearchResults } from "@/lib/mock-data";

const MODES = [
  { value: "keyword", label: "키워드" },
  { value: "semantic", label: "의미" },
  { value: "rag", label: "RAG" },
] as const;

export function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const query = useDriveStore((s) => s.searchQuery);
  const setQuery = useDriveStore((s) => s.setSearchQuery);
  const mode = useDriveStore((s) => s.searchMode);
  const setMode = useDriveStore((s) => s.setSearchMode);
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

  function open_(documentId: string) {
    selectDocument(documentId);
    setMobileRight(true);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
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

        <div className="flex gap-1">
          {MODES.map((m) => (
            <Badge
              key={m.value}
              variant={mode === m.value ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setMode(m.value)}
            >
              {m.label}
            </Badge>
          ))}
        </div>

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
}
