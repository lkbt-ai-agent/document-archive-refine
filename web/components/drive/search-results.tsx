"use client";

import * as React from "react";
import {
  ArrowLeft,
  ChevronDown,
  Download,
  Eye,
  FileText,
  FolderInput,
  MoreHorizontal,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

// 결과 원본 문서 row 공용 액션 — 상세/다운로드/폴더 이동/삭제 (키워드·의미·rag 공용)
const useResultRowActions = (documentId: string) => {
  const doc = useDriveStore((s) =>
    s.documents.find((d) => d.id === documentId),
  );
  const selectDocument = useDriveStore((s) => s.selectDocument);
  const deleteDocument = useDriveStore((s) => s.deleteDocument);
  const selectFolder = useDriveStore((s) => s.selectFolder);
  const setMobileRight = useDriveStore((s) => s.setMobileRight);

  return {
    doc,
    download: () => toast.info("presigned GET 다운로드 (목업)"),
    // 폴더 이동 + 해당 문서 선택(산출물 내역 row 클릭과 동일 동작)
    moveToFolder: doc
      ? () => {
          selectFolder(doc.folderId);
          selectDocument(documentId);
          setMobileRight(true);
        }
      : undefined,
    remove: () => {
      deleteDocument(documentId);
      toast.warning(`"${doc?.name ?? "문서"}" 삭제 (목업)`);
    },
  };
};

// "⋯" 드롭다운
const ResultRowMenu = ({ documentId }: { documentId: string }) => {
  const a = useResultRowActions(documentId);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="문서 작업"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={a.download}>
          <Download className="size-4" /> 다운로드
        </DropdownMenuItem>
        {a.moveToFolder && (
          <DropdownMenuItem onClick={a.moveToFolder}>
            <FolderInput className="size-4" /> 해당 폴더로 이동
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={a.remove}>
          <Trash2 className="size-4" /> 삭제
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// 우클릭 컨텍스트 메뉴 — "⋯"와 동일 항목
const ResultRowContextMenu = ({
  documentId,
  children,
}: {
  documentId: string;
  children: React.ReactNode;
}) => {
  const a = useResultRowActions(documentId);
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={a.download}>
          <Download className="size-4" /> 다운로드
        </ContextMenuItem>
        {a.moveToFolder && (
          <ContextMenuItem onClick={a.moveToFolder}>
            <FolderInput className="size-4" /> 해당 폴더로 이동
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={a.remove}>
          <Trash2 className="size-4" /> 삭제
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
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

// 키워드/의미: 문서 목록 table 디자인을 따르고, 청크 정보는 해당 row 밑 subrow(확장)로 표시.
const RetrievalList = ({
  results,
  elapsedMs,
  activeDocId,
  onOpen,
  onSelect,
}: {
  results: SearchResultItem[];
  elapsedMs: number;
  activeDocId: string | null;
  onOpen: (documentId: string) => void;
  onSelect: (documentId: string) => void;
}) => {
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead>
              <TableHead className="hidden text-right sm:table-cell">
                점수
              </TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((r) => {
              const open = expanded.has(r.chunkId);
              return (
                <React.Fragment key={r.chunkId}>
                  {/* 본 row — 단일 클릭=선택, 더블 클릭=인스펙터 토글, 우클릭=컨텍스트 메뉴 */}
                  <ResultRowContextMenu documentId={r.documentId}>
                    <TableRow
                      className={cn(
                        "cursor-pointer select-none border-b-0",
                        activeDocId === r.documentId && "bg-accent/60",
                      )}
                      onClick={() => onSelect(r.documentId)}
                      onDoubleClick={() => onOpen(r.documentId)}
                    >
                      <TableCell className="max-w-0">
                        <div className="flex items-center gap-2">
                          <FileText className="size-4 shrink-0 text-muted-foreground" />
                          <span className="truncate font-medium">{r.title}</span>
                          <span className="shrink-0 text-xs text-muted-foreground tabular-nums sm:hidden">
                            {r.score.toFixed(2)}
                          </span>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {r.documentName}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {r.snippet}
                        </p>
                      </TableCell>
                      <TableCell className="hidden align-top text-right text-xs text-muted-foreground tabular-nums sm:table-cell">
                        {r.score.toFixed(2)}
                      </TableCell>
                      <TableCell
                        className="align-top"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            aria-label="청크 정보"
                            aria-expanded={open}
                            onClick={() => toggle(r.chunkId)}
                          >
                            <ChevronDown
                              className={cn(
                                "size-4 transition-transform",
                                open && "rotate-180",
                              )}
                            />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            aria-label="상세 보기"
                            onClick={() => onOpen(r.documentId)}
                          >
                            <Eye className="size-4" />
                          </Button>
                          <ResultRowMenu documentId={r.documentId} />
                        </div>
                      </TableCell>
                    </TableRow>
                  </ResultRowContextMenu>
                  {/* 청크 정보 subrow — 여백 적은 카드, 일치 청크를 잘림 없이 전부 표시 */}
                  {open && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={3} className="p-0 pb-2">
                        <div className="space-y-1 rounded-md border bg-muted/30 p-2 text-[11px]">
                          <div className="flex justify-between gap-3">
                            <span className="text-muted-foreground">
                              chunk_id
                            </span>
                            <span className="font-mono">{r.chunkId}</span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-muted-foreground">
                              chunk_index
                            </span>
                            <span className="tabular-nums">{r.chunkIndex}</span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-muted-foreground">score</span>
                            <span className="tabular-nums">
                              {r.score.toFixed(4)}
                            </span>
                          </div>
                          <p className="pt-1 leading-relaxed break-words whitespace-pre-wrap text-muted-foreground">
                            {r.snippet}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      )}
    </>
  );
};

// rag: 합성 답변 + 인용 출처 + 공통 메타
const RagAnswer = ({
  elapsedMs,
  activeDocId,
  onOpen,
  onSelect,
}: {
  elapsedMs: number;
  activeDocId: string | null;
  onOpen: (documentId: string) => void;
  onSelect: (documentId: string) => void;
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
            <ResultRowContextMenu key={c.n} documentId={c.documentId}>
              <div
                className={cn(
                  "rounded-lg border",
                  activeDocId === c.documentId && "bg-accent/60",
                )}
              >
                <div
                  className="flex cursor-pointer items-start gap-2 p-3"
                  onClick={() => onSelect(c.documentId)}
                  onDoubleClick={() => onOpen(c.documentId)}
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
                  <div
                    className="flex shrink-0 items-center gap-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label="상세 보기"
                      onClick={() => onOpen(c.documentId)}
                    >
                      <Eye className="size-4" />
                    </Button>
                    <ResultRowMenu documentId={c.documentId} />
                  </div>
                </div>
                <ChunkToggle chunkId={c.chunkId} snippet={c.snippet} />
              </div>
            </ResultRowContextMenu>
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
  const selectedDocumentId = useDriveStore((s) => s.selectedDocumentId);
  const highlightedDocId = useDriveStore((s) => s.highlightedDocId);
  const selectDocument = useDriveStore((s) => s.selectDocument);
  const highlightDocument = useDriveStore((s) => s.highlightDocument);
  const setMobileRight = useDriveStore((s) => s.setMobileRight);
  // 선택(하이라이트)/인스펙터 대상 — 상호배타라 하나만 활성
  const activeDocId = selectedDocumentId ?? highlightedDocId;

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

  // 단일 클릭 = 선택(하이라이트)만. 더블 클릭/눈 = 인스펙터 토글(같은 문서 재토글 시 닫힘).
  const onSelect = (documentId: string) => highlightDocument(documentId);
  const onOpen = (documentId: string) => {
    const isOpen = useDriveStore.getState().selectedDocumentId === documentId;
    if (isOpen) {
      selectDocument(null);
      setMobileRight(false);
    } else {
      selectDocument(documentId);
      setMobileRight(true);
    }
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
              <RagAnswer
                elapsedMs={elapsedMs}
                activeDocId={activeDocId}
                onOpen={onOpen}
                onSelect={onSelect}
              />
            ) : (
              <RetrievalList
                results={results}
                elapsedMs={elapsedMs}
                activeDocId={activeDocId}
                onOpen={onOpen}
                onSelect={onSelect}
              />
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};
