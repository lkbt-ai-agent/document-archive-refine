"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  FileText,
  Folder as FolderIcon,
  MoreHorizontal,
  Download,
  Trash2,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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
import { StatusBadge } from "./status-badge";
import {
  useFolderActions,
  FolderActionsMenu,
  FolderContextMenu,
} from "./folder-actions";
import { useDriveStore } from "@/lib/store";
import { useFolders } from "@/lib/api/folders";
import {
  useDocuments,
  useDeleteDocument,
  triggerDownload,
} from "@/lib/api/documents";
import { mapDocument } from "@/lib/api/map";
import { errorMessage } from "@/lib/api/client";
import { folderHref } from "@/lib/routes";
import { formatBytes, formatDate } from "@/lib/format";
import type { DocumentItem, Folder } from "@/lib/types";

// Google Drive 식 목록 — 하위 폴더 row + 문서 row 를 한 테이블에 (document-frontend §1).
type ListRow =
  | { kind: "folder"; id: string; folder: Folder }
  | { kind: "doc"; id: string; doc: DocumentItem };

export const DocumentList = ({
  folderId,
  docId,
}: {
  folderId: string;
  docId?: string;
}) => {
  const router = useRouter();
  const { data: folders = [] } = useFolders();
  const docsQuery = useDocuments(folderId);
  const deleteDoc = useDeleteDocument();

  const selectedDocumentId = useDriveStore((s) => s.selectedDocumentId);
  const highlightedDocId = useDriveStore((s) => s.highlightedDocId);
  const highlightedFolderId = useDriveStore((s) => s.highlightedFolderId);
  const inspectedFolderId = useDriveStore((s) => s.inspectedFolderId);
  const selectDocument = useDriveStore((s) => s.selectDocument);
  const highlightDocument = useDriveStore((s) => s.highlightDocument);
  const highlightFolder = useDriveStore((s) => s.highlightFolder);
  const inspectFolder = useDriveStore((s) => s.inspectFolder);
  const resetSelection = useDriveStore((s) => s.resetSelection);
  const setMobileRight = useDriveStore((s) => s.setMobileRight);

  // 라우트(폴더/딥링크 doc)에 인스펙터 정합: doc 있으면 열고, 없으면(=폴더 전환) 닫음.
  React.useEffect(() => {
    if (docId) {
      selectDocument(docId);
      setMobileRight(true);
    } else {
      resetSelection();
    }
  }, [folderId, docId, selectDocument, setMobileRight, resetSelection]);

  const { onAction, dialogs } = useFolderActions();

  const folderName = folders.find((f) => f.id === folderId)?.name ?? "폴더";

  const docs = React.useMemo(
    () =>
      (docsQuery.data?.pages ?? []).flatMap((p) => p.items).map(mapDocument),
    [docsQuery.data],
  );

  // 폴더 먼저, 문서 다음 (Drive 정렬)
  const rows = React.useMemo<ListRow[]>(() => {
    const sub = folders
      .filter((f) => f.parentId === folderId)
      .map((f) => ({ kind: "folder", id: f.id, folder: f }) as const);
    const docRows = docs.map(
      (d) => ({ kind: "doc", id: d.id, doc: d }) as const,
    );
    return [...sub, ...docRows];
  }, [folders, docs, folderId]);

  // 문서 작업 핸들러 — 다운로드(presigned GET)·삭제.
  const onDownload = (id: string) =>
    triggerDownload(id).catch((e) => toast.error(errorMessage(e)));
  const onDeleteDoc = (id: string, name: string) =>
    deleteDoc.mutate(id, {
      onSuccess: () => toast.success(`"${name}" 문서를 삭제했습니다.`),
      onError: (e) => toast.error(errorMessage(e)),
    });

  // 단일 클릭=선택(하이라이트), 더블 클릭=문서 인스펙터 열기 / 폴더 진입.
  const onFolderDoubleClick = (id: string) => router.push(folderHref(id));
  const onDocOpen = (id: string) => {
    selectDocument(id);
    setMobileRight(true);
  };

  const columns = React.useMemo<ColumnDef<ListRow>[]>(
    () => [
      {
        id: "name",
        header: "이름",
        cell: ({ row }) => {
          const r = row.original;
          if (r.kind === "folder") {
            return (
              <div className="flex items-center gap-2">
                <FolderIcon className="size-4 shrink-0 text-primary" />
                <span className="truncate font-medium">{r.folder.name}</span>
              </div>
            );
          }
          const d = r.doc;
          return (
            <>
              <div className="flex items-center gap-2">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{d.name}</span>
              </div>
              <div className="mt-1 sm:hidden">
                <StatusBadge status={d.status} stage={d.stage} />
              </div>
            </>
          );
        },
      },
      {
        id: "status",
        header: "상태",
        cell: ({ row }) => {
          const r = row.original;
          if (r.kind !== "doc")
            return <span className="text-muted-foreground">—</span>;
          return <StatusBadge status={r.doc.status} stage={r.doc.stage} />;
        },
      },
      {
        id: "size",
        header: "크기",
        cell: ({ row }) => {
          const r = row.original;
          return r.kind === "doc" ? formatBytes(r.doc.sizeBytes) : "—";
        },
      },
      {
        id: "createdAt",
        header: "등록일",
        cell: ({ row }) => {
          const r = row.original;
          return r.kind === "doc"
            ? formatDate(r.doc.createdAt)
            : r.folder.createdAt
              ? formatDate(r.folder.createdAt)
              : "—";
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const r = row.original;
          if (r.kind === "folder") {
            const fid = r.folder.id;
            return (
              <div className="flex items-center justify-end gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label="폴더 정보"
                  onClick={() => {
                    inspectFolder(fid);
                    setMobileRight(true);
                  }}
                >
                  <Eye className="size-4" />
                </Button>
                <FolderActionsMenu
                  folder={r.folder}
                  onAction={onAction}
                  className="size-7"
                />
              </div>
            );
          }
          const d = r.doc;
          return (
            <div className="flex items-center justify-end gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label="상세 보기"
                onClick={() => {
                  selectDocument(d.id);
                  setMobileRight(true);
                }}
              >
                <Eye className="size-4" />
              </Button>
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
                  <DropdownMenuItem onClick={() => onDownload(d.id)}>
                    <Download className="size-4" /> 다운로드
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => onDeleteDoc(d.id, d.name)}
                  >
                    <Trash2 className="size-4" /> 삭제
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectDocument, inspectFolder, setMobileRight, onAction],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  const cellHiddenClass: Record<string, string> = {
    status: "hidden sm:table-cell",
    size: "hidden md:table-cell text-muted-foreground tabular-nums",
    createdAt: "hidden lg:table-cell text-muted-foreground tabular-nums",
    actions: "w-16",
  };

  const docCount = docs.length;
  const isEmpty = rows.length === 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-2.5 sm:px-6">
        <h2 className="truncate text-sm font-semibold">{folderName}</h2>
        <span className="text-xs text-muted-foreground">{docCount}개 문서</span>
      </div>

      <ScrollArea className="flex-1">
        {docsQuery.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Spinner /> 불러오는 중…
          </div>
        ) : docsQuery.isError ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileText />
              </EmptyMedia>
              <EmptyTitle>불러오지 못했습니다</EmptyTitle>
              <EmptyDescription>{errorMessage(docsQuery.error)}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : isEmpty ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileText />
              </EmptyMedia>
              <EmptyTitle>비어 있음</EmptyTitle>
              <EmptyDescription>
                이 폴더에는 하위 폴더나 문서가 없습니다.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="px-2 sm:px-4">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    {hg.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className={cellHiddenClass[header.column.id]}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => {
                  const r = row.original;
                  const isActive =
                    r.kind === "doc"
                      ? selectedDocumentId === r.doc.id ||
                        highlightedDocId === r.doc.id
                      : inspectedFolderId === r.folder.id ||
                        highlightedFolderId === r.folder.id;
                  const tableRow = (
                    <TableRow
                      onClick={
                        r.kind === "doc"
                          ? () => highlightDocument(r.doc.id)
                          : () => highlightFolder(r.folder.id)
                      }
                      onDoubleClick={
                        r.kind === "folder"
                          ? () => onFolderDoubleClick(r.folder.id)
                          : () => onDocOpen(r.doc.id)
                      }
                      className={cn(
                        "cursor-pointer select-none",
                        isActive && "bg-accent/60",
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            cell.column.id === "name" && "max-w-0",
                            cellHiddenClass[cell.column.id],
                          )}
                          onClick={
                            cell.column.id === "actions"
                              ? (e) => e.stopPropagation()
                              : undefined
                          }
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  );

                  if (r.kind === "folder") {
                    return (
                      <FolderContextMenu
                        key={row.id}
                        folder={r.folder}
                        onAction={onAction}
                      >
                        {tableRow}
                      </FolderContextMenu>
                    );
                  }
                  const d = r.doc;
                  return (
                    <ContextMenu key={row.id}>
                      <ContextMenuTrigger asChild>{tableRow}</ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem onClick={() => onDownload(d.id)}>
                          <Download className="size-4" /> 다운로드
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          variant="destructive"
                          onClick={() => onDeleteDoc(d.id, d.name)}
                        >
                          <Trash2 className="size-4" /> 삭제
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </ScrollArea>

      {/* 서버 keyset 페이지네이션 — 다음 페이지 cursor 가 있으면 더 보기 */}
      {docsQuery.hasNextPage && (
        <div className="flex justify-center border-t px-4 py-2">
          <Button
            variant="outline"
            size="sm"
            disabled={docsQuery.isFetchingNextPage}
            onClick={() => docsQuery.fetchNextPage()}
          >
            {docsQuery.isFetchingNextPage ? "불러오는 중…" : "더 보기"}
          </Button>
        </div>
      )}

      {/* 폴더 이동/이름변경/삭제 다이얼로그(공용) */}
      {dialogs}
    </div>
  );
};
