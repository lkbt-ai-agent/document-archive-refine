"use client";

import * as React from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { useDriveStore } from "@/lib/store";

export function MetadataEditor() {
  const doc = useDriveStore((s) =>
    s.documents.find((d) => d.id === s.selectedDocumentId),
  );
  const updateDocMeta = useDriveStore((s) => s.updateDocMeta);

  // 초기값은 선택 문서에서 직접 파생. 문서 변경 시에는 부모가 key 로 remount
  // (RightPanel: key={selectedDocumentId}) → effect 동기화 불필요.
  const [title, setTitle] = React.useState(doc?.llmTitle ?? "");
  const [summary, setSummary] = React.useState(doc?.llmSummary ?? "");
  const [topics, setTopics] = React.useState((doc?.topics ?? []).join(", "));
  const [keywords, setKeywords] = React.useState(
    (doc?.keywords ?? []).join(", "),
  );

  if (!doc) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>메타데이터</EmptyTitle>
            <EmptyDescription>문서를 선택하면 편집할 수 있습니다.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const toList = (s: string) =>
    s
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

  function save() {
    updateDocMeta(doc!.id, {
      llmTitle: title,
      llmSummary: summary,
      topics: toList(topics),
      keywords: toList(keywords),
    });
    toast.success("메타데이터 저장 (PATCH /documents/{id} — 목업)");
  }

  return (
    <div className="space-y-4 p-4">
      <div className="space-y-1.5">
        <Label htmlFor="md-title">제목</Label>
        <Input
          id="md-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="LLM 생성 제목"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="md-summary">요약</Label>
        <Textarea
          id="md-summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="LLM 생성 요약"
          rows={4}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="md-topics">토픽 (쉼표 구분)</Label>
        <Input
          id="md-topics"
          value={topics}
          onChange={(e) => setTopics(e.target.value)}
          placeholder="연봉, 계약"
        />
        <div className="flex flex-wrap gap-1 pt-1">
          {toList(topics).map((t) => (
            <Badge key={t} variant="secondary">
              {t}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="md-keywords">키워드 (쉼표 구분)</Label>
        <Input
          id="md-keywords"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="기본급, 성과급"
        />
        <div className="flex flex-wrap gap-1 pt-1">
          {toList(keywords).map((t) => (
            <Badge key={t} variant="outline">
              {t}
            </Badge>
          ))}
        </div>
      </div>

      <Button onClick={save} className="w-full">
        <Save className="size-4" /> 저장
      </Button>
    </div>
  );
}
