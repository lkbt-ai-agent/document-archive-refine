"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
import { useDocument, fetchDocument } from "@/lib/api/documents";
import {
  useArtifacts,
  useCreateGeneration,
  useGeneration,
  useInvalidateGenerations,
} from "@/lib/api/generations";
import { errorMessage } from "@/lib/api/client";
import { folderHref } from "@/lib/routes";
import { formatDate, genKindLabel, genStatusLabel } from "@/lib/format";
import type { GenKind, GenStatus } from "@/lib/types";

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

// 진행 중 생성 1건 — queued/running 동안 폴링하다 종료되면 onDone 으로 알림(목록 갱신).
const InflightRow = ({
  genId,
  kind,
  onDone,
}: {
  genId: string;
  kind: GenKind;
  onDone: (genId: string, status: GenStatus) => void;
}) => {
  const { data: gen } = useGeneration(genId);
  const status = gen?.status;
  React.useEffect(() => {
    if (status === "succeeded" || status === "failed") onDone(genId, status);
  }, [status, genId, onDone]);

  if (!gen || status === "succeeded") return null;
  return (
    <div className="rounded-md border p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{genKindLabel[kind]}</span>
        <span className={cn("text-xs", genStatusColor[gen.status])}>
          {genStatusLabel[gen.status]}
        </span>
      </div>
      {gen.status === "running" && (
        <Progress value={gen.progressPct} className="mt-2 h-1" />
      )}
    </div>
  );
};

export const GenerationPanel = () => {
  const selectedId = useDriveStore((s) => s.selectedDocumentId);
  const { data: doc } = useDocument(selectedId);
  const router = useRouter();

  const { data: artifacts = [] } = useArtifacts(selectedId);
  const createGen = useCreateGeneration();
  const invalidate = useInvalidateGenerations();

  const [open, setOpen] = React.useState(false);
  const [kind, setKind] = React.useState<GenKind>("summary");
  // 방금 트리거한 진행 중 생성들(완료 시 목록으로 이동).
  const [inflight, setInflight] = React.useState<{ id: string; kind: GenKind }[]>([]);

  const generate = () => {
    if (!doc) return;
    createGen.mutate(
      { kind, documentId: doc.id },
      {
        onSuccess: (g) => {
          setInflight((prev) => [{ id: g.id, kind }, ...prev]);
          toast.success(`${genKindLabel[kind]} 생성을 시작했습니다.`);
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
    setOpen(false);
  };

  const onInflightDone = React.useCallback(
    (genId: string, status: GenStatus) => {
      setInflight((prev) => {
        const done = prev.find((p) => p.id === genId);
        if (done) {
          if (status === "succeeded")
            toast.success(`${genKindLabel[done.kind]} 생성 완료 — 산출물 문서로 추가됨`);
          else toast.error(`${genKindLabel[done.kind]} 생성 실패`);
        }
        return prev.filter((p) => p.id !== genId);
      });
      invalidate();
    },
    [invalidate],
  );

  // 산출물 내역 row 클릭 → 산출물 문서 폴더로 이동(+해당 문서 인스펙터 딥링크).
  const openArtifact = async (outputDocId: string) => {
    try {
      const out = await fetchDocument(outputDocId);
      router.push(folderHref(out.folderId, out.id));
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="flex flex-col">
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
              <Button onClick={generate} disabled={!doc || createGen.isPending}>
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

      <div className="space-y-2 px-4 pb-4">
        {inflight.map((g) => (
          <InflightRow
            key={g.id}
            genId={g.id}
            kind={g.kind}
            onDone={onInflightDone}
          />
        ))}

        {inflight.length === 0 && artifacts.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            이 문서의 산출물이 없습니다.
          </p>
        )}

        {artifacts.map((g) => (
          <button
            key={g.id}
            type="button"
            disabled={!g.output_document_id}
            onClick={() =>
              g.output_document_id && openArtifact(g.output_document_id)
            }
            className={cn(
              "block w-full rounded-md border p-2.5 text-left",
              g.output_document_id
                ? "cursor-pointer hover:bg-accent"
                : "cursor-default",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{genKindLabel[g.kind]}</span>
              <span className={cn("text-xs", genStatusColor.succeeded)}>
                {genStatusLabel.succeeded}
              </span>
            </div>
            {g.created_at && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {formatDate(g.created_at)}
              </p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
