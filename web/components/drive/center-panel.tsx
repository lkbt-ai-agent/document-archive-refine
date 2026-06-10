"use client";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { DocumentList } from "./document-list";
import { DocumentDetail } from "./document-detail";

export function CenterPanel() {
  return (
    <ResizablePanelGroup orientation="vertical" className="h-full">
      <ResizablePanel defaultSize="60%" minSize="30%">
        <DocumentList />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize="40%" minSize="20%">
        <DocumentDetail />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
