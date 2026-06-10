"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { DocumentDetail } from "./document-detail";
import { MetadataView } from "./metadata-view";
import { GenerationPanel } from "./generation-panel";

// DetailInspector(토글형) = 문서 상세 + 메타데이터(읽기 전용) + 생성 (arch 10 §8b)
// 패널 자체 닫기 버튼 없음 — PC는 row 재클릭 토글, 모바일은 Sheet 닫기로 닫는다.
export const RightPanel = () => {
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center border-b px-3 py-2">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          문서 상세
        </span>
      </div>

      <div className="shrink-0">
        <DocumentDetail />
      </div>

      <Separator />

      <Tabs defaultValue="meta" className="flex min-h-0 flex-1 flex-col gap-0">
        <div className="px-3 pt-3">
          <TabsList className="w-full">
            <TabsTrigger value="meta" className="flex-1">
              메타데이터
            </TabsTrigger>
            <TabsTrigger value="gen" className="flex-1">
              생성
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="meta" className="min-h-0 flex-1 overflow-y-auto">
          <MetadataView />
        </TabsContent>
        <TabsContent value="gen" className="min-h-0 flex-1 overflow-hidden">
          <GenerationPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};
