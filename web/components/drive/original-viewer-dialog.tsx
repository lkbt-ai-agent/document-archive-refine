"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FileText, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { dialogMobileFullscreen, isImage, isPdf } from "@/lib/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { fetchOriginalText, fetchDownloadUrl } from "@/lib/api/documents";
import { errorMessage } from "@/lib/api/client";
import type { DocumentItem } from "@/lib/types";

// 원본 보기 (document-frontend §2): 텍스트=마크다운 / PDF=iframe / 이미지=img.
// 본문·URL은 presigned GET 으로 직접 받아온다(브라우저→MinIO, CORS 필요). PDF·이미지는 inline disposition.
export const OriginalViewerDialog = ({
  doc,
  open,
  onOpenChange,
}: {
  doc: DocumentItem | undefined;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) => {
  const mime = doc?.mime ?? "";
  const mode = isImage(mime) ? "image" : isPdf(mime) ? "pdf" : "text";

  // 텍스트는 본문을, PDF·이미지는 inline presigned URL을 받는다.
  const text = useQuery({
    queryKey: ["original-text", doc?.id],
    enabled: open && !!doc && mode === "text",
    queryFn: () => fetchOriginalText(doc!.id),
  });
  const url = useQuery({
    queryKey: ["original-url", doc?.id],
    enabled: open && !!doc && mode !== "text",
    queryFn: () => fetchDownloadUrl(doc!.id, true),
  });

  const loading = mode === "text" ? text.isLoading : url.isLoading;
  const errored = mode === "text" ? text.isError : url.isError;
  const err = mode === "text" ? text.error : url.error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          dialogMobileFullscreen,
          mode === "text" ? "sm:max-w-2xl" : "sm:max-w-4xl",
        )}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-4 text-primary" /> 원본 보기
          </DialogTitle>
          <DialogDescription className="flex items-center justify-between gap-2">
            <span className="truncate">{doc?.name}</span>
            {mode !== "text" && url.data && (
              <a
                href={url.data}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1 text-xs text-primary hover:underline"
              >
                새 탭에서 열기 <ExternalLink className="size-3" />
              </a>
            )}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Spinner /> 원본을 불러오는 중…
          </div>
        ) : errored ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {errorMessage(err)}
          </p>
        ) : mode === "pdf" ? (
          <iframe
            src={url.data}
            title={doc?.name ?? "원본"}
            className="h-[70dvh] w-full rounded-md border max-md:h-[calc(100dvh-9rem)]"
          />
        ) : mode === "image" ? (
          <ScrollArea className="max-h-[70dvh] max-md:max-h-[calc(100dvh-9rem)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url.data}
              alt={doc?.name ?? "원본"}
              className="mx-auto h-auto max-w-full rounded-md"
            />
          </ScrollArea>
        ) : (
          <ScrollArea className="max-h-[60dvh] max-md:max-h-[calc(100dvh-9rem)]">
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
              <Markdown remarkPlugins={[remarkGfm]}>{text.data ?? ""}</Markdown>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};
