"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
import { useDriveStore } from "@/lib/store";
import { useSearch, useAsk } from "@/lib/api/search";
import { useDocument, useDeleteDocument, triggerDownload } from "@/lib/api/documents";
import { errorMessage } from "@/lib/api/client";
import { folderHref, ROOT_FOLDER_ID } from "@/lib/routes";
import { formatDuration } from "@/lib/format";
import type { Citation, SearchMode, SearchResultItem } from "@/lib/types";

// 검색 결과 화면(search-frontend §3·§3a·§4) — Center 본문에 렌더. 조회 화면을 대체한다.
const MODE_LABEL: Record<SearchMode, string> = {
  keyword: "키워드",
  semantic: "의미",
  rag: "RAG",
};

// 결과 row 공용 액션 — 다운로드/폴더 이동/삭제. 필요한 값(폴더·이름)을 인자로 받아 store 비의존.
const useResultRowActions = (item: {
  documentId: string;
  folderId: string;
  documentName: string;
}) => {
  const router = useRouter();
  const del = useDeleteDocument();
  return {
    download: () =>
      triggerDownload(item.documentId).catch((e) => toast.error(errorMessage(e))),
    // 폴더 이동 + 해당 문서 선택 — 폴더 URL + ?doc 딥링크
    moveToFolder: () =>
      router.push(folderHref(item.folderId, item.documentId)),
    remove: () =>
      del.mutate(item.documentId, {
        onSuccess: () => toast.success(`"${item.documentName}" 문서를 삭제했습니다.`),
        onError: (e) => toast.error(errorMessage(e)),
      }),
  };
};

const RowActions = ({
  item,
  variant,
}: {
  item: { documentId: string; folderId: string; documentName: string };
  variant: "dropdown" | "context";
}) => {
  const a = useResultRowActions(item);
  if (variant === "context") {
    return (
      <ContextMenuContent>
        <ContextMenuItem onClick={a.download}>
          <Download className="size-4" /> 다운로드
        </ContextMenuItem>
        <ContextMenuItem onClick={a.moveToFolder}>
          <FolderInput className="size-4" /> 해당 폴더로 이동
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={a.remove}>
          <Trash2 className="size-4" /> 삭제
        </ContextMenuItem>
      </ContextMenuContent>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-7" aria-label="문서 작업">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={a.download}>
          <Download className="size-4" /> 다운로드
        </DropdownMenuItem>
        <DropdownMenuItem onClick={a.moveToFolder}>
          <FolderInput className="size-4" /> 해당 폴더로 이동
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={a.remove}>
          <Trash2 className="size-4" /> 삭제
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

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
              <TableHead className="hidden text-right sm:table-cell">점수</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((r) => {
              const open = expanded.has(r.chunkId);
              const item = {
                documentId: r.documentId,
                folderId: r.folderId,
                documentName: r.documentName,
              };
              return (
                <React.Fragment key={r.chunkId}>
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
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
                            <RowActions item={item} variant="dropdown" />
                          </div>
                        </TableCell>
                      </TableRow>
                    </ContextMenuTrigger>
                    <RowActions item={item} variant="context" />
                  </ContextMenu>
                  {/* 청크 정보 subrow — 일치 청크를 잘림 없이 전부 표시 */}
                  {open && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={3} className="p-0 pb-2">
                        <div className="space-y-1 rounded-md border bg-muted/30 p-2 text-[11px]">
                          <div className="flex justify-between gap-3">
                            <span className="text-muted-foreground">chunk_id</span>
                            <span className="font-mono">{r.chunkId}</span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-muted-foreground">score</span>
                            <span className="tabular-nums">{r.score.toFixed(4)}</span>
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

// rag 인용 카드 — /search/ask 는 {n, chunk_id, document_id}만 주므로 문서명은 단건 조회로 보강.
const CitationCard = ({
  citation,
  activeDocId,
  onOpen,
  onSelect,
}: {
  citation: Citation;
  activeDocId: string | null;
  onOpen: (documentId: string) => void;
  onSelect: (documentId: string) => void;
}) => {
  const { data: doc } = useDocument(citation.documentId);
  const item = {
    documentId: citation.documentId,
    folderId: doc?.folderId ?? ROOT_FOLDER_ID,
    documentName: doc?.name ?? "문서",
  };
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            "rounded-lg border",
            activeDocId === citation.documentId && "bg-accent/60",
          )}
        >
          <div
            className="flex cursor-pointer items-start gap-2 p-3"
            onClick={() => onSelect(citation.documentId)}
            onDoubleClick={() => onOpen(citation.documentId)}
          >
            <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded bg-primary/15 text-xs font-medium text-primary">
              {citation.n}
            </span>
            <div className="min-w-0 flex-1">
              <span className="flex items-center gap-1 text-sm font-medium">
                <FileText className="size-3.5 shrink-0" />
                <span className="truncate">{item.documentName}</span>
              </span>
              <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                {citation.chunkId}
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
                onClick={() => onOpen(citation.documentId)}
              >
                <Eye className="size-4" />
              </Button>
              <RowActions item={item} variant="dropdown" />
            </div>
          </div>
        </div>
      </ContextMenuTrigger>
      <RowActions item={item} variant="context" />
    </ContextMenu>
  );
};

// rag: 합성 답변 + 인용 출처 + 공통 메타
const RagAnswer = ({
  answer,
  citations,
  elapsedMs,
  activeDocId,
  onOpen,
  onSelect,
}: {
  answer: string;
  citations: Citation[];
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
        const cit = citations.find((c) => c.n === n);
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
        응답 {formatDuration(elapsedMs)} · 인용 {citations.length}개
      </p>
      <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
        <p className="text-sm leading-relaxed">{renderAnswer(answer)}</p>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
          인용 출처
        </p>
        <div className="space-y-2">
          {citations.map((c) => (
            <CitationCard
              key={c.n}
              citation={c}
              activeDocId={activeDocId}
              onOpen={onOpen}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
    </>
  );
};

export const SearchResults = ({ q, mode }: { q: string; mode: SearchMode }) => {
  const router = useRouter();
  const selectedDocumentId = useDriveStore((s) => s.selectedDocumentId);
  const highlightedDocId = useDriveStore((s) => s.highlightedDocId);
  const selectDocument = useDriveStore((s) => s.selectDocument);
  const highlightDocument = useDriveStore((s) => s.highlightDocument);
  const resetSelection = useDriveStore((s) => s.resetSelection);
  const setSearchQuery = useDriveStore((s) => s.setSearchQuery);
  const setMobileRight = useDriveStore((s) => s.setMobileRight);
  const activeDocId = selectedDocumentId ?? highlightedDocId;

  const search = useSearch(q, mode);
  const ask = useAsk(q, mode);

  // 라우트(q/mode) 변경마다 인스펙터 해제 + SearchBar 입력 동기화.
  React.useEffect(() => {
    resetSelection();
    setSearchQuery(q);
  }, [q, mode, resetSelection, setSearchQuery]);

  const loading = mode === "rag" ? ask.isLoading : search.isLoading;
  const error = mode === "rag" ? ask.error : search.error;

  // 단일 클릭 = 선택(하이라이트)만. 더블 클릭/눈 = 인스펙터 열기.
  const onSelect = (documentId: string) => highlightDocument(documentId);
  const onOpen = (documentId: string) => {
    selectDocument(documentId);
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
          onClick={() => router.back()}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">
            {`${MODE_LABEL[mode]} 검색 결과`}
          </h2>
          {q && <p className="truncate text-xs text-muted-foreground">“{q}”</p>}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Spinner /> {mode === "rag" ? "컨텍스트 조립 + 답변 생성 중…" : "검색 중…"}
        </div>
      ) : error ? (
        <Empty className="py-12">
          <EmptyHeader>
            <EmptyTitle>검색 실패</EmptyTitle>
            <EmptyDescription>{errorMessage(error)}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ScrollArea className="flex-1">
          <div className="space-y-3 px-3 pb-6 sm:px-4">
            {mode === "rag" ? (
              <RagAnswer
                answer={ask.data?.answer ?? ""}
                citations={ask.data?.citations ?? []}
                elapsedMs={ask.data?.elapsedMs ?? 0}
                activeDocId={activeDocId}
                onOpen={onOpen}
                onSelect={onSelect}
              />
            ) : (
              <RetrievalList
                results={search.data?.results ?? []}
                elapsedMs={search.data?.elapsedMs ?? 0}
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
