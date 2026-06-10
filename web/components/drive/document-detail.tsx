"use client";

import * as React from "react";
import { Download, Eye, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "./status-badge";
import { OriginalViewerDialog } from "./original-viewer-dialog";
import { useDriveStore } from "@/lib/store";
import { formatBytes, formatDate } from "@/lib/format";
import { isTextLike } from "@/lib/ui";

const MetaRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between gap-4 py-1 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="truncate text-right tabular-nums">{value}</span>
  </div>
);

export const DocumentDetail = () => {
  const doc = useDriveStore((s) =>
    s.documents.find((d) => d.id === s.selectedDocumentId),
  );
  const [viewerOpen, setViewerOpen] = React.useState(false);

  if (!doc) return null;

  // "원본 보기": 텍스트류 = 마크다운 뷰어 / 그 외 = presigned 다운로드 (arch 10 §10)
  const onViewOriginal = () => {
    if (isTextLike(doc.mime)) {
      setViewerOpen(true);
    } else {
      toast.info("텍스트가 아닌 파일은 다운로드합니다 (presigned GET — 목업)");
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div className="min-w-0">
        <h3 className="truncate font-semibold">{doc.llmTitle ?? doc.name}</h3>
        <p className="truncate text-xs text-muted-foreground">{doc.name}</p>
      </div>

      <StatusBadge status={doc.status} stage={doc.stage} progress={doc.progress} />

      {doc.status === "failed" && doc.error && (
        <div className="flex items-start gap-2 rounded-md border border-status-failed/40 bg-status-failed/10 p-2.5 text-sm text-status-failed">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>{doc.error}</span>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={onViewOriginal}
        >
          <Eye className="size-4" /> 원본 보기
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={() => toast.info("presigned GET 다운로드 (목업)")}
        >
          <Download className="size-4" /> 다운로드
        </Button>
      </div>

      <Separator />

      <div>
        <MetaRow label="크기" value={formatBytes(doc.sizeBytes)} />
        <MetaRow label="형식" value={doc.mime} />
        {doc.pageCount != null && (
          <MetaRow label="페이지" value={`${doc.pageCount}p`} />
        )}
        {doc.author && <MetaRow label="작성자" value={doc.author} />}
        <MetaRow label="등록일" value={formatDate(doc.createdAt)} />
      </div>

      <OriginalViewerDialog doc={doc} open={viewerOpen} onOpenChange={setViewerOpen} />
    </div>
  );
};
