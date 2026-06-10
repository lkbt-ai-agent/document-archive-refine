"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { stageLabel, statusLabel } from "@/lib/format";
import type { DocStatus, DocStage } from "@/lib/types";

const dotByStatus: Record<DocStatus, string> = {
  ready: "bg-status-ready",
  processing: "bg-status-processing",
  failed: "bg-status-failed",
  uploaded: "bg-status-uploaded",
};

const textByStatus: Record<DocStatus, string> = {
  ready: "text-status-ready",
  processing: "text-status-processing",
  failed: "text-status-failed",
  uploaded: "text-status-uploaded",
};

export function StatusBadge({
  status,
  stage,
  progress,
  className,
}: {
  status: DocStatus;
  stage?: DocStage;
  progress?: number;
  className?: string;
}) {
  const label =
    status === "processing" && stage
      ? `${stageLabel[stage]}${typeof progress === "number" ? ` ${progress}%` : ""}`
      : statusLabel[status];

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 font-normal", textByStatus[status], className)}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          dotByStatus[status],
          status === "processing" && "animate-pulse",
        )}
      />
      {label}
    </Badge>
  );
}
