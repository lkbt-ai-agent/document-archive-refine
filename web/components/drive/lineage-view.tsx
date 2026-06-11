"use client";

import { GitBranch, FileText, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useDriveStore } from "@/lib/store";
import { formatDate, formatDuration, genKindLabel } from "@/lib/format";

// AI 산출물(= 어떤 생성의 output) 문서의 계보 섹션 — 메타데이터 패널 상단에 표시.
// 실 데이터는 GET /generations/{id}/lineage (arch 09 §10, 10 §7a). 계보 헤드는 산출물 삭제 후에도 보존.
const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between gap-4 py-1 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="truncate text-right tabular-nums">{value}</span>
  </div>
);

export const LineageView = () => {
  const doc = useDriveStore((s) =>
    s.documents.find((d) => d.id === s.selectedDocumentId),
  );
  const documents = useDriveStore((s) => s.documents);
  const generations = useDriveStore((s) => s.generations);
  const selectFolder = useDriveStore((s) => s.selectFolder);
  const selectDocument = useDriveStore((s) => s.selectDocument);

  if (!doc) return null;

  // 산출물 판별: 이 문서를 output 으로 가지는 생성. 없으면 일반 문서 → 계보 미표시.
  const gen = generations.find((g) => g.outputDocumentId === doc.id);
  if (!gen) return null;

  // 부모(원본) 문서들 — 다중 원본 대비. 삭제돼 없으면 doc=undefined → 비활성 표기.
  const parents = (gen.sourceDocumentIds ?? [gen.documentId]).map((id) => ({
    id,
    doc: documents.find((d) => d.id === id),
  }));

  // 부모 링크 클릭 → Center가 부모 폴더로 이동 + 인스펙터에 부모 문서 표시
  const openParent = (parentId: string, folderId: string) => {
    selectFolder(folderId);
    selectDocument(parentId);
  };

  const hasPrompt = gen.prompt != null;

  return (
    <div className="space-y-4 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
        <GitBranch className="size-3.5" />
        AI 산출물 계보
        <Badge variant="secondary" className="ml-auto">
          {genKindLabel[gen.kind]}
        </Badge>
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          원본 문서
        </p>
        <div className="space-y-1">
          {parents.map((p) =>
            p.doc ? (
              <button
                key={p.id}
                type="button"
                onClick={() => openParent(p.doc!.id, p.doc!.folderId)}
                className="flex w-full items-center gap-2 rounded-md border bg-background p-2 text-left text-sm hover:bg-accent"
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{p.doc.llmTitle ?? p.doc.name}</span>
              </button>
            ) : (
              <div
                key={p.id}
                className="flex items-center gap-2 rounded-md border border-dashed p-2 text-sm text-muted-foreground"
              >
                <FileText className="size-4 shrink-0" />
                <span className="truncate italic">삭제된 문서</span>
              </div>
            ),
          )}
        </div>
      </div>

      <Separator />

      <div>
        <Row label="모델" value={gen.model ?? "—"} />
        <Row label="provider" value={gen.provider ?? "—"} />
        {gen.seed != null && <Row label="seed" value={gen.seed} />}
        {gen.elapsedMs != null && (
          <Row label="생성 소요" value={formatDuration(gen.elapsedMs)} />
        )}
        <Row label="생성 시각" value={formatDate(gen.createdAt)} />
      </div>

      {hasPrompt && (
        <>
          <Separator />
          <Collapsible>
            <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              프롬프트 (재현성)
              <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2">
              <div>
                <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                  system
                </p>
                <pre className="whitespace-pre-wrap break-words rounded-md bg-muted/60 p-2.5 text-xs leading-relaxed">
                  {gen.prompt!.system}
                </pre>
              </div>
              <div>
                <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                  user
                </p>
                <pre className="whitespace-pre-wrap break-words rounded-md bg-muted/60 p-2.5 text-xs leading-relaxed">
                  {gen.prompt!.user}
                </pre>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </>
      )}
    </div>
  );
};
