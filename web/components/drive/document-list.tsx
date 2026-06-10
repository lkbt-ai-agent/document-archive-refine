"use client";

import * as React from "react";
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
import { StatusBadge } from "./status-badge";
import { useDriveStore } from "@/lib/store";
import { formatBytes, formatDate } from "@/lib/format";
import type { DocumentItem, Folder } from "@/lib/types";

// Google Drive 식 목록 — 하위 폴더 row + 문서 row 를 한 테이블에 (arch 10 §10).
type ListRow =
  | { kind: "folder"; id: string; folder: Folder }
  | { kind: "doc"; id: string; doc: DocumentItem };

const PAGE_SIZE = 10;

export const DocumentList = () => {
  const folderId = useDriveStore((s) => s.selectedFolderId);
  const folders = useDriveStore((s) => s.folders);
  const documents = useDriveStore((s) => s.documents);
  const selectedDocumentId = useDriveStore((s) => s.selectedDocumentId);
  const selectFolder = useDriveStore((s) => s.selectFolder);
  const selectDocument = useDriveStore((s) => s.selectDocument);
  const deleteDocument = useDriveStore((s) => s.deleteDocument);
  const setMobileRight = useDriveStore((s) => s.setMobileRight);

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

  // 서버사이드 페이지네이션 기준(manualPagination) — 프로토타입은 클라이언트 슬라이스로 흉내,
  // 추후 GET /documents?folder_id=&limit=&cursor= 로 배선.
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });

  // 폴더 전환 시 1페이지로 리셋
  React.useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [folderId]);

  const total = rows.length;
  const pageRows = React.useMemo(() => {
    const start = pagination.pageIndex * pagination.pageSize;
    return rows.slice(start, start + pagination.pageSize);
  }, [rows, pagination]);

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
          if (r.kind !== "doc") return null;
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
          return r.kind === "doc" ? formatDate(r.doc.createdAt) : "—";
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const r = row.original;
          if (r.kind !== "doc") return null;
          const d = r.doc;
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
                <DropdownMenuItem onClick={() => selectDocument(d.id)}>
                  <Eye className="size-4" /> 상세 보기
                </DropdownMenuItem>
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
          );
        },
      },
    ],
    [selectDocument, deleteDocument],
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

  // 컬럼별 반응형 노출(상태/크기/등록일은 좁은 화면에서 숨김)
  const cellHiddenClass: Record<string, string> = {
    status: "hidden sm:table-cell",
    size: "hidden md:table-cell text-muted-foreground tabular-nums",
    createdAt: "hidden lg:table-cell text-muted-foreground tabular-nums",
    actions: "w-10",
  };

  const onRowActivate = (r: ListRow) => {
    if (r.kind === "folder") {
      selectFolder(r.folder.id); // 폴더 진입(selectedDocumentId 초기화 → 인스펙터 접힘)
    } else {
      // 같은 row 재클릭 시 토글로 닫힘 (없으면 PC에서 닫히지 않음)
      const isOpen = selectedDocumentId === r.doc.id;
      selectDocument(isOpen ? null : r.doc.id);
      setMobileRight(!isOpen);
    }
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
                  const isSelectedDoc =
                    r.kind === "doc" && selectedDocumentId === r.doc.id;
                  return (
                    <TableRow
                      key={row.id}
                      onClick={() => onRowActivate(r)}
                      className={cn(
                        "cursor-pointer",
                        isSelectedDoc && "bg-accent/60",
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
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </ScrollArea>

      {/* 서버 페이지네이션 컨트롤(흉내) — 1페이지면 숨김 */}
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
    </div>
  );
};
