"use client";

import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { useDriveStore } from "@/lib/store";
import { LineageView } from "./lineage-view";

// AI 생성 메타데이터 — 읽기 전용 표시 (사용자 보정 MVP 제외; arch 10 §7a).
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      {label}
    </p>
    {children}
  </div>
);

export const MetadataView = () => {
  const doc = useDriveStore((s) =>
    s.documents.find((d) => d.id === s.selectedDocumentId),
  );

  if (!doc) return null;

  const hasMeta =
    doc.llmSummary || doc.topics.length > 0 || doc.keywords.length > 0;

  return (
    <div className="space-y-4 p-4">
      {/* 산출물 문서면 계보 섹션(부모 링크·모델/seed·프롬프트) 표시, 아니면 null */}
      <LineageView />

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Sparkles className="size-3.5 text-primary" />
        AI가 생성한 메타데이터 (읽기 전용)
      </div>

      {!hasMeta ? (
        <Empty className="py-8">
          <EmptyHeader>
            <EmptyTitle>메타데이터 없음</EmptyTitle>
            <EmptyDescription>
              처리가 완료되면 AI가 생성한 메타데이터가 표시됩니다.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          {doc.llmSummary && (
            <Field label="요약">
              <p className="rounded-md bg-muted/50 p-3 text-sm leading-relaxed">
                {doc.llmSummary}
              </p>
            </Field>
          )}

          {doc.topics.length > 0 && (
            <Field label="토픽">
              <div className="flex flex-wrap gap-1">
                {doc.topics.map((t) => (
                  <Badge key={t} variant="secondary">
                    {t}
                  </Badge>
                ))}
              </div>
            </Field>
          )}

          {doc.keywords.length > 0 && (
            <>
              <Separator />
              <Field label="키워드">
                <div className="flex flex-wrap gap-1">
                  {doc.keywords.map((k) => (
                    <Badge key={k} variant="outline">
                      {k}
                    </Badge>
                  ))}
                </div>
              </Field>
            </>
          )}
        </>
      )}
    </div>
  );
};
