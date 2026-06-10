"use client";

import * as React from "react";
import { Sparkles, FileText, FileEdit, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { dialogMobileFullscreen } from "@/lib/ui";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useDriveStore } from "@/lib/store";
import {
  formatDate,
  formatDuration,
  genKindLabel,
  genStatusLabel,
} from "@/lib/format";
import type { GenKind, GenStatus, Generation } from "@/lib/types";

const KIND_OPTIONS: { kind: GenKind; icon: React.ElementType; desc: string }[] = [
  { kind: "summary", icon: FileText, desc: "STUFF / MAP-REDUCE 요약" },
  { kind: "draft", icon: FileEdit, desc: "outline-then-expand 초안" },
  { kind: "report", icon: BarChart3, desc: "통계 + Vega-Lite 차트 보고서" },
];

const genStatusColor: Record<GenStatus, string> = {
  succeeded: "text-status-ready",
  running: "text-status-processing",
  failed: "text-status-failed",
  queued: "text-status-uploaded",
};

export const GenerationPanel = () => {
  const doc = useDriveStore((s) =>
    s.documents.find((d) => d.id === s.selectedDocumentId),
  );
  const documents = useDriveStore((s) => s.documents);
  const generations = useDriveStore((s) => s.generations);
  const startGeneration = useDriveStore((s) => s.startGeneration);
  const selectFolder = useDriveStore((s) => s.selectFolder);
  const selectDocument = useDriveStore((s) => s.selectDocument);
  const setMobileRight = useDriveStore((s) => s.setMobileRight);
  const [open, setOpen] = React.useState(false);
  const [kind, setKind] = React.useState<GenKind>("summary");

  const generate = () => {
    if (!doc) return;
    startGeneration(kind, doc.id);
    setOpen(false);
    toast.success(
      `${genKindLabel[kind]} 생성 요청 (POST /generations → 202, 목업)`,
    );
  };

  // 산출물 내역 = 현재 원본 문서의 생성. 성공 건은 출력 문서가 존재할 때만(삭제 시 비노출, arch 09 §9a).
  const items = generations.filter(
    (g) =>
      g.documentId === doc?.id &&
      (g.status !== "succeeded" ||
        (g.outputDocumentId != null &&
          documents.some((d) => d.id === g.outputDocumentId))),
  );

  // 산출물 내역 row 클릭 → Center가 산출물 문서 폴더로 이동·선택 (plan 1.13.5)
  const openArtifact = (g: Generation) => {
    const out = g.outputDocumentId
      ? documents.find((d) => d.id === g.outputDocumentId)
      : undefined;
    if (!out) return;
    selectFolder(out.folderId);
    selectDocument(out.id);
    setMobileRight(true);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="p-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full" disabled={!doc}>
              <Sparkles className="size-4" /> AI 산출물 생성
            </Button>
          </DialogTrigger>
          <DialogContent className={cn(dialogMobileFullscreen, "sm:max-w-sm")}>
            <DialogHeader>
              <DialogTitle>AI 산출물 생성</DialogTitle>
              <DialogDescription>
                {doc ? `"${doc.name}" 기반으로 생성합니다.` : "문서를 선택하세요."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              {KIND_OPTIONS.map((o) => {
                const Icon = o.icon;
                return (
                  <button
                    key={o.kind}
                    type="button"
                    onClick={() => setKind(o.kind)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent",
                      kind === o.kind && "border-primary bg-accent",
                    )}
                  >
                    <Icon className="size-5 text-primary" />
                    <div>
                      <div className="text-sm font-medium">
                        {genKindLabel[o.kind]}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {o.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <DialogFooter>
              <Button onClick={generate} disabled={!doc}>
                <Sparkles className="size-4" /> 생성 시작
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Separator />

      <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        산출물 내역
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 pb-4">
        {items.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            이 문서의 산출물이 없습니다.
          </p>
        )}
        {items.map((g) => {
          const navigable = g.status === "succeeded" && g.outputDocumentId != null;
          return (
            <button
              key={g.id}
              type="button"
              disabled={!navigable}
              onClick={() => navigable && openArtifact(g)}
              className={cn(
                "block w-full rounded-md border p-2.5 text-left",
                navigable
                  ? "cursor-pointer hover:bg-accent"
                  : "cursor-default",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{genKindLabel[g.kind]}</span>
                <span className={cn("text-xs", genStatusColor[g.status])}>
                  {genStatusLabel[g.status]}
                </span>
              </div>
              {g.status === "running" && (
                <Progress value={g.progressPct} className="mt-2 h-1" />
              )}
              <p className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span>{formatDate(g.createdAt)}</span>
                {g.elapsedMs != null && (
                  <span className="tabular-nums">
                    생성 {formatDuration(g.elapsedMs)}
                  </span>
                )}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};
