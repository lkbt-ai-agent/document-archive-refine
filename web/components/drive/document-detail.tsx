"use client";

import { Download, FileText, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { StatusBadge } from "./status-badge";
import { useDriveStore } from "@/lib/store";
import { formatBytes, formatDate } from "@/lib/format";

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right tabular-nums">{value}</span>
    </div>
  );
}

export function DocumentDetail() {
  const docId = useDriveStore((s) => s.selectedDocumentId);
  const doc = useDriveStore((s) =>
    s.documents.find((d) => d.id === s.selectedDocumentId),
  );

  if (!docId || !doc) {
    return (
      <div className="flex h-full items-center justify-center">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileText />
            </EmptyMedia>
            <EmptyTitle>문서를 선택하세요</EmptyTitle>
            <EmptyDescription>
              목록에서 문서를 클릭하면 상세 정보가 표시됩니다.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-semibold">
              {doc.llmTitle ?? doc.name}
            </h3>
            <p className="truncate text-xs text-muted-foreground">{doc.name}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={() => toast.info("presigned GET 다운로드 (목업)")}
          >
            <Download className="size-4" /> 다운로드
          </Button>
        </div>

        <StatusBadge
          status={doc.status}
          stage={doc.stage}
          progress={doc.progress}
        />

        {doc.status === "failed" && doc.error && (
          <div className="flex items-start gap-2 rounded-md border border-status-failed/40 bg-status-failed/10 p-2.5 text-sm text-status-failed">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span>{doc.error}</span>
          </div>
        )}

        {doc.llmSummary && (
          <p className="rounded-md bg-muted/50 p-3 text-sm leading-relaxed">
            {doc.llmSummary}
          </p>
        )}

        <Separator />

        <div>
          <MetaRow label="크기" value={formatBytes(doc.sizeBytes)} />
          <MetaRow label="형식" value={doc.mime} />
          {doc.pageCount != null && (
            <MetaRow label="페이지" value={`${doc.pageCount}p`} />
          )}
          {doc.author && <MetaRow label="작성자" value={doc.author} />}
          <MetaRow label="수정일" value={formatDate(doc.updatedAt)} />
        </div>

        <div className="flex h-40 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
          미리보기 영역 (목업)
        </div>
      </div>
    </ScrollArea>
  );
}
