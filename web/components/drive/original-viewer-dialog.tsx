"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FileText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { dialogMobileFullscreen } from "@/lib/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { fetchOriginalText } from "@/lib/api/documents";
import { errorMessage } from "@/lib/api/client";
import type { DocumentItem } from "@/lib/types";

// 텍스트류 문서 원본을 마크다운 뷰어로 표시 (document-frontend §2).
// 비텍스트 문서는 호출부에서 다운로드로 분기하므로 여기엔 텍스트만 들어온다.
// 본문은 presigned GET 으로 직접 받아온다(브라우저→MinIO, CORS 필요).
export const OriginalViewerDialog = ({
  doc,
  open,
  onOpenChange,
}: {
  doc: DocumentItem | undefined;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) => {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["original", doc?.id],
    enabled: open && !!doc,
    queryFn: () => fetchOriginalText(doc!.id),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(dialogMobileFullscreen, "sm:max-w-2xl")}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-4 text-primary" /> 원본 보기
          </DialogTitle>
          <DialogDescription className="truncate">{doc?.name}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60dvh] max-md:max-h-[calc(100dvh-9rem)]">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Spinner /> 원본을 불러오는 중…
            </div>
          ) : isError ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {errorMessage(error)}
            </p>
          ) : (
            <div
              className={cn(
                "pr-3 text-sm leading-relaxed",
                "[&_h1]:mt-3 [&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-semibold",
                "[&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:font-semibold",
                "[&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
                "[&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
                "[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse",
                "[&_th]:border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_td]:border [&_td]:px-2 [&_td]:py-1",
                "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs",
              )}
            >
              <Markdown remarkPlugins={[remarkGfm]}>{data ?? ""}</Markdown>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
