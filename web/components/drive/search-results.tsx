"use client";

import * as React from "react";
import { ArrowLeft, ChevronDown, FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useDriveStore } from "@/lib/store";
import { mockAskAnswer, mockSearchResults } from "@/lib/mock-data";
import { formatDuration } from "@/lib/format";
import type { SearchMode, SearchResultItem } from "@/lib/types";

// 검색 결과 화면(search-frontend §3·§3a·§4) — Center 본문에 렌더. 조회 화면을 대체한다.
// 키워드/의미 = 결과 리스트, rag = 답변 + 인용. 공통 메타(응답 시간·개수) + row별 청크 toggle.
const MODE_LABEL: Record<SearchMode, string> = {
  keyword: "키워드",
  semantic: "의미",
  rag: "RAG",
};

// 각 리스트 row 아래 "청크 정보" toggle (§3a)
const ChunkToggle = ({
  chunkId,
  chunkIndex,
  score,
  snippet,
}: {
  chunkId: string;
  chunkIndex?: number;
  score?: number;
  snippet: string;
}) => (
  <Collapsible>
    <CollapsibleTrigger className="group flex w-full items-center gap-1.5 border-t px-3 py-1.5 text-[11px] text-muted-foreground hover:bg-accent/50">
      <ChevronDown className="size-3.5 transition-transform group-data-[state=open]:rotate-180" />
      청크 정보
    </CollapsibleTrigger>
    <CollapsibleContent className="space-y-1 border-t bg-muted/30 px-3 py-2 text-[11px]">
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">chunk_id</span>
        <span className="font-mono">{chunkId}</span>
      </div>
      {chunkIndex != null && (
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">chunk_index</span>
          <span className="tabular-nums">{chunkIndex}</span>
        </div>
      )}
      {score != null && (
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">score</span>
          <span className="tabular-nums">{score.toFixed(4)}</span>
        </div>
      )}
      <p className="pt-1 leading-relaxed">{snippet}</p>
    </CollapsibleContent>
  </Collapsible>
);

// 키워드/의미: 결과 리스트 + 공통 메타
const RetrievalList = ({
  results,
  elapsedMs,
  onOpen,
}: {
  results: SearchResultItem[];
  elapsedMs: number;
  onOpen: (documentId: string) => void;
}) => (
  <>
    <p className="pt-1 text-[11px] text-muted-foreground tabular-nums">
      응답 {formatDuration(elapsedMs)} · 결과 {results.length}건
    </p>
    {results.length === 0 ? (
      <Empty className="py-12">
        <EmptyHeader>
          <EmptyTitle>결과 없음</EmptyTitle>
          <EmptyDescription>다른 키워드로 검색해 보세요.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    ) : (
      results.map((r) => (
        <div key={r.chunkId} className="rounded-lg border">
          <button
            type="button"
            onClick={() => onOpen(r.documentId)}
            className="flex w-full items-start gap-2 rounded-t-lg p-3 text-left hover:bg-accent"
          >
            <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{r.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {r.score.toFixed(2)}
                </span>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {r.documentName}
              </p>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {r.snippet}
              </p>
            </div>
          </button>
          <ChunkToggle
            chunkId={r.chunkId}
            chunkIndex={r.chunkIndex}
            score={r.score}
            snippet={r.snippet}
          />
        </div>
      ))
    )}
  </>
);

// rag: 합성 답변 + 인용 출처 + 공통 메타
const RagAnswer = ({
  elapsedMs,
  onOpen,
}: {
  elapsedMs: number;
  onOpen: (documentId: string) => void;
}) => {
  // 답변 텍스트의 [n] 을 클릭 가능한 인용 표식으로 분해
  const renderAnswer = (text: string) =>
    text.split(/(\[\d+\])/g).map((part, i) => {
      const m = part.match(/\[(\d+)\]/);
      if (m) {
        const n = Number(m[1]);
        const cit = mockAskAnswer.citations.find((c) => c.n === n);
        return (
          <button
            key={i}
            type="button"
            onClick={() => cit && onOpen(cit.documentId)}
            className="mx-0.5 inline-flex items-center rounded bg-primary/15 px-1 align-middle text-xs font-medium text-primary hover:bg-primary/25"
          >
            {part}
          </button>
        );
      }
      return <span key={i}>{part}</span>;
    });

  return (
    <>
      <p className="pt-1 text-[11px] text-muted-foreground tabular-nums">
        응답 {formatDuration(elapsedMs)} · 인용 {mockAskAnswer.citations.length}개
      </p>
      <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
        <p className="text-sm leading-relaxed">
          {renderAnswer(mockAskAnswer.answer)}
        </p>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
          인용 출처
        </p>
        <div className="space-y-2">
          {mockAskAnswer.citations.map((c) => (
            <div key={c.n} className="rounded-lg border">
              <button
                type="button"
                onClick={() => onOpen(c.documentId)}
                className="flex w-full items-start gap-2 rounded-t-lg p-3 text-left hover:bg-accent"
              >
                <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded bg-primary/15 text-xs font-medium text-primary">
                  {c.n}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 text-sm font-medium">
                    <FileText className="size-3.5 shrink-0" />
                    <span className="truncate">{c.documentName}</span>
                  </span>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {c.snippet}
                  </p>
                </div>
              </button>
              <ChunkToggle chunkId={c.chunkId} snippet={c.snippet} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export const SearchResults = () => {
  const mode = useDriveStore((s) => s.searchMode);
  const query = useDriveStore((s) => s.searchSubmittedQuery);
  const nonce = useDriveStore((s) => s.searchNonce);
  const closeSearch = useDriveStore((s) => s.closeSearch);
  const selectDocument = useDriveStore((s) => s.selectDocument);
  const setMobileRight = useDriveStore((s) => s.setMobileRight);

  // 로딩을 nonce 일치 여부로 파생(§3) — 실행 즉시 loading=true, 타이머 완료 시 해제.
  // (effect 내 동기 setState 회피)
  const [loadedNonce, setLoadedNonce] = React.useState(0);
  const loading = loadedNonce !== nonce;

  React.useEffect(() => {
    const t = window.setTimeout(
      () => setLoadedNonce(nonce),
      mode === "rag" ? 900 : 500,
    );
    return () => window.clearTimeout(t);
  }, [nonce, mode]);

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

  // 총 응답 시간(목업) — 실제로는 /search·/search/ask 응답의 elapsed_ms (§3a)
  const elapsedMs =
    mode === "rag"
      ? 820 + query.length * 11
      : 110 + query.length * 6 + results.length * 8;

  const onOpen = (documentId: string) => {
    selectDocument(documentId); // 결과는 유지하고 우측 인스펙터에 문서 표시
    setMobileRight(true);
  };

  return (
    <div className="flex h-full flex-col">
      {/* 화면 제목 + 뒤로가기 버튼(§4) */}
      <div className="flex items-center gap-2 px-3 py-2.5 sm:px-4">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          aria-label="조회 화면으로 돌아가기"
          onClick={closeSearch}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">
            {mode ? `${MODE_LABEL[mode]} 검색 결과` : "검색 결과"}
          </h2>
          {query && (
            <p className="truncate text-xs text-muted-foreground">“{query}”</p>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Spinner /> {mode === "rag" ? "컨텍스트 조립 + 답변 생성 중…" : "검색 중…"}
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="space-y-3 px-3 pb-6 sm:px-4">
            {mode === "rag" ? (
              <RagAnswer elapsedMs={elapsedMs} onOpen={onOpen} />
            ) : (
              <RetrievalList
                results={results}
                elapsedMs={elapsedMs}
                onOpen={onOpen}
              />
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};
