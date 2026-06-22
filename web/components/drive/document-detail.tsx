"use client";

import * as React from "react";
import { Download, Eye, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StatusBadge } from "./status-badge";
import { OriginalViewerDialog } from "./original-viewer-dialog";
import { useDriveStore } from "@/lib/store";
import {
  useDocument,
  useDeleteDocument,
  triggerDownload,
} from "@/lib/api/documents";
import { errorMessage } from "@/lib/api/client";
import { formatBytes, formatDate, formatDuration } from "@/lib/format";
import { ingestProgress } from "@/lib/ingest";
import { isPreviewable } from "@/lib/ui";

const MetaRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between gap-4 py-1 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="truncate text-right tabular-nums">{value}</span>
  </div>
);

export const DocumentDetail = () => {
  const selectedId = useDriveStore((s) => s.selectedDocumentId);
  const { data: doc } = useDocument(selectedId);
  // 업로드 진행률(클라 세션) — 인제스트 단계 진행과 합쳐 상태 태그 밑 바로 표시(frontend.md §11)
  const uploadPct = useDriveStore((s) =>
    doc ? s.uploadProgress[doc.id] : undefined,
  );
  const closeInspector = useDriveStore((s) => s.closeInspector);
  const clearUploadProgress = useDriveStore((s) => s.clearUploadProgress);
  const deleteDoc = useDeleteDocument();
  const [viewerOpen, setViewerOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);

  if (!doc) return null;

  const progress = ingestProgress(doc.status, doc.stage, uploadPct);

  // 진행 중(업로드/처리) 취소 = 문서 삭제(D12). 백엔드가 진행 중 job을 선제 취소(D13).
  const onCancelIngest = () => {
    const id = doc.id;
    deleteDoc.mutate(id, {
      onSuccess: () => toast.success("처리를 취소하고 문서를 삭제했습니다."),
      onError: (e) => toast.error(errorMessage(e)),
    });
    clearUploadProgress(id);
    closeInspector();
  };

  // "원본 보기" (document-frontend §2): 텍스트=마크다운 뷰어 / PDF·이미지=인앱 미리보기 / 그 외=다운로드
  const onViewOriginal = () => {
    if (isPreviewable(doc.mime)) {
      setViewerOpen(true);
    } else {
      triggerDownload(doc.id).catch((e) => toast.error(errorMessage(e)));
    }
  };
  const onDownload = () =>
    triggerDownload(doc.id).catch((e) => toast.error(errorMessage(e)));

  return (
    <div className="space-y-4 p-4">
      <div className="min-w-0">
        {/* 큰 제목=원본 파일명(전체 표시, 잘림 없음) / 작은 제목=논리 제목(ai 보정) */}
        <h3 className="font-semibold break-words">{doc.name}</h3>
        {doc.llmTitle && (
          <p className="truncate text-xs text-muted-foreground">{doc.llmTitle}</p>
        )}
      </div>

      <StatusBadge status={doc.status} stage={doc.stage} progress={doc.progress} />

      {/* 상태 태그 밑 진행 표시 — 업로드/인제스트 각 단계 (frontend.md §11) + 취소(=삭제) */}
      {progress && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Progress value={progress.pct} className="flex-1" />
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-muted-foreground hover:text-status-failed"
              onClick={() => setCancelOpen(true)}
            >
              <X className="size-4" /> 취소
            </Button>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{progress.label}</span>
            <span className="tabular-nums">{progress.pct}%</span>
          </div>
        </div>
      )}

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
          onClick={onDownload}
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
        {doc.ingestMs != null && (
          <MetaRow label="처리 시간" value={formatDuration(doc.ingestMs)} />
        )}
      </div>

      <OriginalViewerDialog doc={doc} open={viewerOpen} onOpenChange={setViewerOpen} />

      {/* 진행 중 취소 확인 — 확정 시 문서 삭제(D12) */}
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>처리를 취소할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{doc.name}&quot; 문서와 진행 중인 처리가 삭제됩니다. 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>닫기</AlertDialogCancel>
            <AlertDialogAction onClick={onCancelIngest}>취소(삭제)</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
