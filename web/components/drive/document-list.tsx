"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type PaginationState,
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
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { folderHref } from "@/lib/routes";
import { formatBytes, formatDate } from "@/lib/format";
import type { DocumentItem, Folder } from "@/lib/types";

// Google Drive 식 목록 — 하위 폴더 row + 문서 row 를 한 테이블에 (arch 10 §10).
type ListRow =
  | { kind: "folder"; id: string; folder: Folder }
  | { kind: "doc"; id: string; doc: DocumentItem };

const PAGE_SIZE = 10;

export const DocumentList = ({
  folderId,
  docId,
}: {
  folderId: string;
  docId?: string;
}) => {
  const router = useRouter();
  const folders = useDriveStore((s) => s.folders);
  const documents = useDriveStore((s) => s.documents);
  const selectedDocumentId = useDriveStore((s) => s.selectedDocumentId);
  const highlightedDocId = useDriveStore((s) => s.highlightedDocId);
  const highlightedFolderId = useDriveStore((s) => s.highlightedFolderId);
  const inspectedFolderId = useDriveStore((s) => s.inspectedFolderId);
  const selectDocument = useDriveStore((s) => s.selectDocument);
  const highlightDocument = useDriveStore((s) => s.highlightDocument);
  const highlightFolder = useDriveStore((s) => s.highlightFolder);
  const inspectFolder = useDriveStore((s) => s.inspectFolder);
  const resetSelection = useDriveStore((s) => s.resetSelection);
  const deleteDocument = useDriveStore((s) => s.deleteDocument);
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

  // 폴더 먼저, 문서 다음 (Drive 정렬)
  const rows = React.useMemo<ListRow[]>(() => {
    const sub = folders
      .filter((f) => f.parentId === folderId)
      .map((f) => ({ kind: "folder", id: f.id, folder: f }) as const);
    const docs = documents
      .filter((d) => d.folderId === folderId)
      .map((d) => ({ kind: "doc", id: d.id, doc: d }) as const);
    return [...sub, ...docs];
  }, [folders, documents, folderId]);

  const docCount = rows.filter((r) => r.kind === "doc").length;

  // 서버사이드 페이지네이션 기준(manualPagination) — 프로토타입은 클라이언트 슬라이스로 흉내.
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });

  React.useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [folderId]);

  const total = rows.length;
  const pageRows = React.useMemo(() => {
    const start = pagination.pageIndex * pagination.pageSize;
    return rows.slice(start, start + pagination.pageSize);
  }, [rows, pagination]);

  // 단일 클릭=선택(하이라이트), 더블 클릭=문서 인스펙터 열기 / 폴더 진입. 닫기는 패널 X(또는 모바일 Sheet).
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
              {d.status === "processing" && typeof d.progress === "number" && (
                <Progress value={d.progress} className="mt-1.5 h-1" />
              )}
              <div className="mt-1 sm:hidden">
                <StatusBadge status={d.status} stage={d.stage} progress={d.progress} />
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
          return (
            <StatusBadge
              status={r.doc.status}
              stage={r.doc.stage}
              progress={r.doc.progress}
            />
          );
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
                  <DropdownMenuItem
                    onClick={() => toast.info("presigned GET 다운로드 (목업)")}
                  >
                    <Download className="size-4" /> 다운로드
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => {
                      deleteDocument(d.id);
                      toast.warning(`"${d.name}" 삭제 (목업)`);
                    }}
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
    [selectDocument, inspectFolder, setMobileRight, deleteDocument, onAction],
  );

  const table = useReactTable({
    data: pageRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    rowCount: total,
    state: { pagination },
    onPaginationChange: setPagination,
    getRowId: (row) => row.id,
  });

  const cellHiddenClass: Record<string, string> = {
    status: "hidden sm:table-cell",
    size: "hidden md:table-cell text-muted-foreground tabular-nums",
    createdAt: "hidden lg:table-cell text-muted-foreground tabular-nums",
    actions: "w-16",
  };

  return (
    <div className="flex h-full flex-col">
      {/* 상단 border 제거 / 좌우 패딩 */}
      <div className="flex items-center justify-between px-4 py-2.5 sm:px-6">
        <h2 className="truncate text-sm font-semibold">{folderName}</h2>
        <span className="text-xs text-muted-foreground">{docCount}개 문서</span>
      </div>

      <ScrollArea className="flex-1">
        {total === 0 ? (
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
                        <ContextMenuItem
                          onClick={() =>
                            toast.info("presigned GET 다운로드 (목업)")
                          }
                        >
                          <Download className="size-4" /> 다운로드
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          variant="destructive"
                          onClick={() => {
                            deleteDocument(d.id);
                            toast.warning(`"${d.name}" 삭제 (목업)`);
                          }}
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

      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between gap-2 border-t px-4 py-2 text-xs text-muted-foreground sm:px-6">
          <span className="tabular-nums">
            {total}개 항목 · {pagination.pageIndex + 1}/{table.getPageCount()}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              이전
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              다음
            </Button>
          </div>
        </div>
      )}

      {/* 폴더 이동/이름변경/삭제 다이얼로그(공용) */}
      {dialogs}
    </div>
  );
};
