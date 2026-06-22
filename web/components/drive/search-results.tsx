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
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
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
import { groupResults, type SearchGroup } from "@/lib/search-group";
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

// 공통 규칙(키워드): 청크 본문에서 질의 일치 부분 하이라이트 (search-frontend §3a).
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const Highlighted = ({ text, query }: { text: string; query: string }) => {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegExp(q)})`, "gi"));
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === q.toLowerCase() ? (
          <mark
            key={i}
            className="rounded bg-yellow-200 px-0.5 text-foreground dark:bg-yellow-500/40"
          >
            {p}
          </mark>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </>
  );
};

// 문서 그룹 카드(화살표 토글 행 + 더보기) — 같은 문서의 매칭 청크를 한 카드에 모은다.
// 키워드: 청크 본문 하이라이트 / 공통: 문서 keywords를 컨셉 해시태그로 표시(검색 응답 포함, 문서 단위).
const ResultGroupCard = ({
  group,
  query,
  mode,
  activeDocId,
  onOpen,
  onSelect,
}: {
  group: SearchGroup;
  query: string;
  mode: SearchMode;
  activeDocId: string | null;
  onOpen: (documentId: string) => void;
  onSelect: (documentId: string) => void;
}) => {
  const [showAll, setShowAll] = React.useState(false);
  // 청크별 본문 펼침 상태(행 클릭 시 토글) — 첫 청크는 기본 펼침
  const [expanded, setExpanded] = React.useState<Set<string>>(
    () => new Set(group.chunks[0] ? [group.chunks[0].chunkId] : []),
  );
  const toggleChunk = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const item = {
    documentId: group.documentId,
    folderId: group.folderId,
    documentName: group.documentName,
  };
  const rest = group.chunks.length - 1;
  const visible = showAll ? group.chunks : group.chunks.slice(0, 1);
  // 문서 keywords 해시태그 — 검색 응답에 포함되어 키워드·의미 모드 공통으로 표시
  const concepts = group.keywords;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            "rounded-lg border",
            activeDocId === group.documentId && "bg-accent/60",
          )}
        >
          <div
            className="flex cursor-pointer items-start gap-2 p-3"
            onClick={() => onSelect(group.documentId)}
            onDoubleClick={() => onOpen(group.documentId)}
          >
            <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              {/* 큰 제목=현재 파일명, 작은 제목=ai 보정 제목(있을 때) */}
              <p className="truncate text-sm font-medium">
                {group.documentName}
              </p>
              {group.llmTitle && (
                <p className="truncate text-xs text-muted-foreground">
                  {group.llmTitle}
                </p>
              )}
            </div>
            <div
              className="flex shrink-0 items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <Badge variant="secondary" className="tabular-nums">
                {group.topScore.toFixed(2)}
              </Badge>
              <Badge variant="outline">청크 {group.chunks.length}</Badge>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label="상세 보기"
                onClick={() => onOpen(group.documentId)}
              >
                <Eye className="size-4" />
              </Button>
              <RowActions item={item} variant="dropdown" />
            </div>
          </div>

          {/* 컨셉 해시태그(문서 단위, 키워드·의미 모드 공통) */}
          {concepts.length > 0 && (
            <div className="flex flex-wrap gap-1 px-3 pb-2">
              {concepts.map((c) => (
                <span
                  key={c}
                  className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                >
                  #{c}
                </span>
              ))}
            </div>
          )}

          {/* 청크 본문 — 화살표 토글 행 + 더보기(첫 청크만 노출, 행 클릭 시 본문 펼침) */}
          <div className="px-3 pb-3">
            <div className="divide-y overflow-hidden rounded-md border">
              {visible.map((c) => {
                const isOpen = expanded.has(c.chunkId);
                return (
                  <div key={c.chunkId}>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => toggleChunk(c.chunkId)}
                      className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-[11px] hover:bg-accent/40"
                    >
                      <ChevronDown
                        className={cn(
                          "size-3.5 shrink-0 text-muted-foreground transition-transform",
                          isOpen && "rotate-180",
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate font-mono text-muted-foreground">
                        {c.chunkId}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        score {c.score.toFixed(4)}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="bg-muted/30 px-2.5 pt-1 pb-2.5">
                        <p className="text-[11px] leading-relaxed break-words whitespace-pre-wrap text-muted-foreground">
                          {mode === "keyword" ? (
                            <Highlighted text={c.snippet} query={query} />
                          ) : (
                            c.snippet
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {rest > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2 w-full"
                aria-expanded={showAll}
                onClick={() => setShowAll((o) => !o)}
              >
                {showAll ? "접기" : `더보기 ${rest}개`}
                <ChevronDown
                  className={cn(
                    "size-4 transition-transform",
                    showAll && "rotate-180",
                  )}
                />
              </Button>
            )}
          </div>
        </div>
      </ContextMenuTrigger>
      <RowActions item={item} variant="context" />
    </ContextMenu>
  );
};

// 키워드/의미: 결과를 문서 단위로 그룹화해 카드로 렌더(문서당 1 카드 + 청크 더보기).
const RetrievalList = ({
  results,
  elapsedMs,
  query,
  mode,
  activeDocId,
  onOpen,
  onSelect,
}: {
  results: SearchResultItem[];
  elapsedMs: number;
  query: string;
  mode: SearchMode;
  activeDocId: string | null;
  onOpen: (documentId: string) => void;
  onSelect: (documentId: string) => void;
}) => {
  const groups = React.useMemo(() => groupResults(results), [results]);

  return (
    <>
      <p className="pt-1 text-[11px] text-muted-foreground tabular-nums">
        응답 {formatDuration(elapsedMs)} · 문서 {groups.length}개 · 청크{" "}
        {results.length}건
      </p>
      {groups.length === 0 ? (
        <Empty className="py-12">
          <EmptyHeader>
            <EmptyTitle>결과 없음</EmptyTitle>
            <EmptyDescription>다른 키워드로 검색해 보세요.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-2">
          {groups.map((g) => (
            <ResultGroupCard
              key={g.documentId}
              group={g}
              query={query}
              mode={mode}
              activeDocId={activeDocId}
              onOpen={onOpen}
              onSelect={onSelect}
            />
          ))}
        </div>
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
              {/* 큰 제목=현재 파일명, 작은 제목=ai 보정 제목(있을 때) */}
              <span className="flex min-w-0 items-center gap-1 text-sm font-medium">
                <FileText className="size-3.5 shrink-0" />
                <span className="truncate">{item.documentName}</span>
              </span>
              {doc?.llmTitle && (
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {doc.llmTitle}
                </p>
              )}
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
        <p className="min-w-0 flex-1 text-sm leading-relaxed break-words">
          {renderAnswer(answer)}
        </p>
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
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
          {/* 네이티브 스크롤 — radix ScrollArea의 display:table 래퍼는 콘텐츠 폭만큼 늘어나
              가로 오버플로우(row 잘림)를 유발하므로, 폭 고정 + 세로 스크롤로 대체(D20·D21) */}
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
                query={q}
                mode={mode}
                activeDocId={activeDocId}
                onOpen={onOpen}
                onSelect={onSelect}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
