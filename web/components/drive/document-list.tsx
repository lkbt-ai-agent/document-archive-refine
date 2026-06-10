"use client";

import * as React from "react";
import { FileText, MoreHorizontal, Download, Trash2, Eye } from "lucide-react";
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
import { UploadDropzone } from "./upload-dropzone";
import { useDriveStore } from "@/lib/store";
import { mockFolders } from "@/lib/mock-data";
import { formatBytes, formatDate } from "@/lib/format";

export function DocumentList() {
  const folderId = useDriveStore((s) => s.selectedFolderId);
  const documents = useDriveStore((s) => s.documents);
  const selectedDocumentId = useDriveStore((s) => s.selectedDocumentId);
  const selectDocument = useDriveStore((s) => s.selectDocument);
  const deleteDocument = useDriveStore((s) => s.deleteDocument);
  const setMobileRight = useDriveStore((s) => s.setMobileRight);

  const folderName =
    mockFolders.find((f) => f.id === folderId)?.name ?? "폴더";
  const docs = documents.filter((d) => d.folderId === folderId);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <h2 className="truncate text-sm font-semibold">{folderName}</h2>
        <span className="text-xs text-muted-foreground">{docs.length}개 문서</span>
      </div>

      <div className="border-b p-3">
        <UploadDropzone />
      </div>

      <ScrollArea className="flex-1">
        {docs.length === 0 ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileText />
              </EmptyMedia>
              <EmptyTitle>문서 없음</EmptyTitle>
              <EmptyDescription>
                위 영역에 파일을 끌어다 놓아 업로드하세요.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이름</TableHead>
                <TableHead className="hidden sm:table-cell">상태</TableHead>
                <TableHead className="hidden md:table-cell">크기</TableHead>
                <TableHead className="hidden lg:table-cell">수정일</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((d) => (
                <TableRow
                  key={d.id}
                  onClick={() => {
                    selectDocument(d.id);
                    setMobileRight(true);
                  }}
                  className={cn(
                    "cursor-pointer",
                    selectedDocumentId === d.id && "bg-accent/60",
                  )}
                >
                  <TableCell className="max-w-0">
                    <div className="flex items-center gap-2">
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{d.name}</span>
                    </div>
                    {d.status === "processing" &&
                      typeof d.progress === "number" && (
                        <Progress value={d.progress} className="mt-1.5 h-1" />
                      )}
                    <div className="mt-1 sm:hidden">
                      <StatusBadge
                        status={d.status}
                        stage={d.stage}
                        progress={d.progress}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <StatusBadge
                      status={d.status}
                      stage={d.stage}
                      progress={d.progress}
                    />
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground tabular-nums">
                    {formatBytes(d.sizeBytes)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground tabular-nums">
                    {formatDate(d.updatedAt)}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
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
                          onClick={() => selectDocument(d.id)}
                        >
                          <Eye className="size-4" /> 상세 보기
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            toast.info("presigned GET 다운로드 (목업)")
                          }
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ScrollArea>
    </div>
  );
}
