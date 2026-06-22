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

// 문서 현재 파일명 변경 다이얼로그. 원본 파일명·AI 논리명은 보존되고 현재 파일명만 바꾼다.
export const DocumentRenameDialog = ({
  open,
  onOpenChange,
  initialName,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialName: string;
  onSubmit: (name: string) => void;
}) => {
  const [name, setName] = React.useState(initialName);

  // 열릴 때 initialName 으로 초기화는 호출부 key 리마운트로 처리.
  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === initialName) {
      onOpenChange(false);
      return;
    }
    onSubmit(trimmed);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(dialogMobileFullscreen, "sm:max-w-sm")}>
        <DialogHeader>
          <DialogTitle>이름 변경</DialogTitle>
          <DialogDescription>
            현재 파일명만 바뀌며, 원본 파일명과 AI 제목은 그대로 유지됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="document-name">파일 이름</Label>
          <Input
            id="document-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>

        <DialogFooter showCloseButton>
          <Button onClick={submit} disabled={!name.trim()}>
            변경
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
