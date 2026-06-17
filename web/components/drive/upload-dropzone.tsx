"use client";

import * as React from "react";
import { UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useDriveStore } from "@/lib/store";
import { useCurrentFolderId } from "@/hooks/use-current-folder";

export const UploadDropzone = () => {
  const folderId = useCurrentFolderId() ?? "root";
  const addUpload = useDriveStore((s) => s.addUpload);
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((f) => addUpload(folderId, f.name, f.size));
    toast.success(
      files.length === 1
        ? `"${files[0].name}" 업로드 시작 (presigned 3단계 — 목업)`
        : `${files.length}개 파일 업로드 시작 (목업)`,
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
