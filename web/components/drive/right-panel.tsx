"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MetadataEditor } from "./metadata-editor";
import { GenerationPanel } from "./generation-panel";
import { useDriveStore } from "@/lib/store";

export function RightPanel() {
  const selectedDocumentId = useDriveStore((s) => s.selectedDocumentId);
  return (
    <Tabs defaultValue="meta" className="flex h-full flex-col gap-0">
      <div className="border-b px-3 pt-3">
        <TabsList className="w-full">
          <TabsTrigger value="meta" className="flex-1">
            메타데이터
          </TabsTrigger>
          <TabsTrigger value="gen" className="flex-1">
            생성
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="meta" className="flex-1 overflow-y-auto">
        <MetadataEditor key={selectedDocumentId ?? "none"} />
      </TabsContent>
      <TabsContent value="gen" className="flex-1 overflow-hidden">
        <GenerationPanel />
      </TabsContent>
    </Tabs>
  );
}
