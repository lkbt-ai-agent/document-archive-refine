"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { GitBranch, FileText, ChevronDown, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useDriveStore } from "@/lib/store";
import { useDocument, fetchDocument } from "@/lib/api/documents";
import {
  useGenerationIdByOutput,
  useLineage,
} from "@/lib/api/generations";
import { folderHref } from "@/lib/routes";
import { formatDate, formatDuration, genKindLabel } from "@/lib/format";

// 차트는 SSR 비호환 → dynamic(ssr:false).
const VegaChart = dynamic(() => import("./vega-chart"), { ssr: false });

// AI 산출물(= 어떤 생성의 output) 문서의 계보 섹션 — 메타데이터 패널 상단에 표시.
// 데이터는 GET /generations/{id}/lineage. 일반 업로드 문서엔 미표시(ai-outputs-frontend §3).
const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between gap-4 py-1 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="truncate text-right tabular-nums">{value}</span>
  </div>
);

export const LineageView = () => {
  const selectedId = useDriveStore((s) => s.selectedDocumentId);
  const { data: doc } = useDocument(selectedId);
  const router = useRouter();

  // 이 문서를 output 으로 가지는 생성 id 역조회. 없으면 일반 문서 → 계보 미표시.
  const { data: generationId } = useGenerationIdByOutput(doc?.id ?? null);
  const { data: lineage, isLoading } = useLineage(generationId ?? null);

  if (!doc || !generationId) return null;

  // 부모(원본) 문서 링크 클릭 → 부모 폴더로 이동 + 인스펙터에 부모 문서 표시(딥링크).
  const openParent = async (parentId: string) => {
    try {
      const parent = await fetchDocument(parentId);
      router.push(folderHref(parent.folderId, parentId));
    } catch {
      /* 삭제됐거나 접근 불가 — 무시 */
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
        <GitBranch className="size-3.5" />
        AI 산출물 계보
        {lineage && (
          <Badge variant="secondary" className="ml-auto">
            {genKindLabel[lineage.kind]}
          </Badge>
        )}
      </div>

      {isLoading || !lineage ? (
        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
          <Spinner className="size-3.5" /> 계보 불러오는 중…
        </div>
      ) : (
        <>
          <div>
            <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              원본 문서
            </p>
            <div className="space-y-1">
              {lineage.sourceDocuments.map((p, i) =>
                p.documentId ? (
                  <button
                    key={p.documentId ?? i}
                    type="button"
                    onClick={() => openParent(p.documentId!)}
                    className="flex w-full items-center gap-2 rounded-md border bg-background p-2 text-left text-sm hover:bg-accent"
                  >
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{p.citedTitle ?? "원본 문서"}</span>
                  </button>
                ) : (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-md border border-dashed p-2 text-sm text-muted-foreground"
                  >
                    <FileText className="size-4 shrink-0" />
                    <span className="truncate italic">
                      {p.citedTitle ?? "삭제된 문서"}
                    </span>
                  </div>
                ),
              )}
            </div>
          </div>

          <Separator />

          <div>
            <Row label="provider" value={lineage.provider ?? "—"} />
            <Row label="모델" value={lineage.model ?? "—"} />
            {lineage.seed != null && <Row label="seed" value={lineage.seed} />}
            {lineage.latencyMs != null && (
              <Row label="생성 소요" value={formatDuration(lineage.latencyMs)} />
            )}
            {lineage.createdAt && (
              <Row label="생성 시각" value={formatDate(lineage.createdAt)} />
            )}
          </div>

          {lineage.charts.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  <BarChart3 className="size-3.5" /> 차트
                </p>
                {lineage.charts.map((c, i) => (
                  <div key={i} className="rounded-md border bg-background p-2">
                    {c.title && (
                      <p className="mb-1 text-xs font-medium">{c.title}</p>
                    )}
                    <VegaChart spec={c.spec} />
                  </div>
                ))}
              </div>
            </>
          )}

          {lineage.prompts.length > 0 && (
            <>
              <Separator />
              <Collapsible>
                <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  프롬프트 (재현성)
                  <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-3">
                  {lineage.prompts.map((p, i) => (
                    <div key={i} className="space-y-2">
                      {p.step && (
                        <p className="text-[11px] font-semibold text-primary">
                          {p.step}
                        </p>
                      )}
                      {p.system && (
                        <div>
                          <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                            system
                          </p>
                          <pre className="whitespace-pre-wrap break-words rounded-md bg-muted/60 p-2.5 text-xs leading-relaxed">
                            {p.system}
                          </pre>
                        </div>
                      )}
                      <div>
                        <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                          prompt
                        </p>
                        <pre className="whitespace-pre-wrap break-words rounded-md bg-muted/60 p-2.5 text-xs leading-relaxed">
                          {p.prompt}
                        </pre>
                      </div>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            </>
          )}
        </>
      )}
    </div>
  );
};
