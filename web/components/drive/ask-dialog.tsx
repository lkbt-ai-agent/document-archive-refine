"use client";

import * as React from "react";
import { Sparkles, CornerDownLeft, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { dialogMobileFullscreen } from "@/lib/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { useDriveStore } from "@/lib/store";
import { mockAskAnswer } from "@/lib/mock-data";

export const AskDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) => {
  const [q, setQ] = React.useState("작년 내 연봉이 얼마였지?");
  const [loading, setLoading] = React.useState(false);
  const [answered, setAnswered] = React.useState(false);
  const selectDocument = useDriveStore((s) => s.selectDocument);
  const setMobileRight = useDriveStore((s) => s.setMobileRight);

  const ask = () => {
    if (!q.trim()) return;
    setLoading(true);
    setAnswered(false);
    setTimeout(() => {
      setLoading(false);
      setAnswered(true);
    }, 800);
  };

  const gotoCitation = (documentId: string) => {
    selectDocument(documentId);
    setMobileRight(true);
    onOpenChange(false);
  };

  // 답변 텍스트에서 [n] 을 클릭 가능한 표식으로 분해
  const renderAnswer = (text: string) =>
    text.split(/(\[\d+\])/g).map((part, i) => {
      const m = part.match(/\[(\d+)\]/);
      if (m) {
        const n = Number(m[1]);
        const c = mockAskAnswer.citations.find((c) => c.n === n);
        return (
          <button
            key={i}
            type="button"
            onClick={() => c && gotoCitation(c.documentId)}
            className="mx-0.5 inline-flex items-center rounded bg-primary/15 px-1 text-xs font-medium text-primary align-middle hover:bg-primary/25"
          >
            {part}
          </button>
        );
      }
      return <span key={i}>{part}</span>;
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(dialogMobileFullscreen, "sm:max-w-xl")}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" /> AI에게 질문 (RAG)
          </DialogTitle>
          <DialogDescription>
            제공된 문서에만 근거해 인용과 함께 답합니다.
          </DialogDescription>
        </DialogHeader>

        {/* 자동 개행 textarea — 초기 1줄 → 최대 ~6줄 후 스크롤 */}
        <div className="relative">
          <Textarea
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask();
              }
            }}
            placeholder="자연어로 질문하세요 (Enter 전송 · Shift+Enter 줄바꿈)"
            rows={1}
            className="max-h-40 min-h-0 resize-none overflow-y-auto py-2 pr-12"
          />
          <Button
            size="icon"
            className="absolute right-1.5 bottom-1.5 size-8"
            aria-label="질문"
            onClick={ask}
            disabled={loading}
          >
            {loading ? <Spinner /> : <CornerDownLeft className="size-4" />}
          </Button>
        </div>

        {loading && (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Spinner /> 컨텍스트 조립 + 생성 중…
          </div>
        )}

        {answered && !loading && (
          <div className="space-y-3">
            <p className="rounded-md bg-muted/50 p-3 text-sm leading-relaxed">
              {renderAnswer(mockAskAnswer.answer)}
            </p>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">출처</p>
              {mockAskAnswer.citations.map((c) => (
                <button
                  key={c.n}
                  type="button"
                  onClick={() => gotoCitation(c.documentId)}
                  className="flex w-full items-start gap-2 rounded-md border p-2 text-left text-sm hover:bg-accent"
                >
                  <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded bg-primary/15 text-xs font-medium text-primary">
                    {c.n}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 font-medium">
                      <FileText className="size-3.5 shrink-0" />
                      <span className="truncate">{c.documentName}</span>
                    </span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      {c.snippet}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
