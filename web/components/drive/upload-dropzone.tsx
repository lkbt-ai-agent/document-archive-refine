"use client";

import * as React from "react";
import { UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useUpload } from "@/lib/api/documents";
import { errorMessage } from "@/lib/api/client";
import { useCurrentFolderId } from "@/hooks/use-current-folder";
import { ROOT_FOLDER_ID } from "@/lib/routes";

export const UploadDropzone = () => {
  const folderId = useCurrentFolderId() ?? ROOT_FOLDER_ID;
  const upload = useUpload();
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // presigned 3단계(init → 브라우저 PUT → confirm)를 파일별로 실행, 완료 시 인제스트 시작.
  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((f) =>
      upload.mutate(
        { folderId, file: f },
        {
          onSuccess: () => toast.success(`"${f.name}" 업로드 완료 — 인제스트 시작`),
          onError: (e) => toast.error(errorMessage(e)),
        },
      ),
    );
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors",
        dragging
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/60 hover:bg-accent/40",
      )}
    >
      <UploadCloud className="size-6 text-muted-foreground" />
      <div className="text-sm">
        <span className="font-medium text-foreground">클릭</span> 또는 파일을
        끌어다 놓아 업로드
      </div>
      <div className="text-xs text-muted-foreground">
        PDF · 이미지 · TXT · MD — presigned PUT 직접 전송(목업)
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
};
