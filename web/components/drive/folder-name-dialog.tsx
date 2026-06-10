"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { dialogMobileFullscreen } from "@/lib/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

// 새 폴더(이름 입력) / 폴더 이름 변경 공용 다이얼로그.
export const FolderNameDialog = ({
  open,
  onOpenChange,
  title,
  description,
  initialName,
  submitLabel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  initialName: string;
  submitLabel: string;
  onSubmit: (name: string) => void;
}) => {
  const [name, setName] = React.useState(initialName);

  // 매번 열릴 때 initialName 으로 초기화 (key 리마운트로 처리)
  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(dialogMobileFullscreen, "sm:max-w-sm")}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="folder-name">폴더 이름</Label>
          <Input
            id="folder-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="예: 2026년 계약서"
          />
        </div>

        <DialogFooter showCloseButton>
          <Button onClick={submit} disabled={!name.trim()}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
