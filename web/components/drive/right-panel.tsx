"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { DocumentDetail } from "./document-detail";
import { MetadataView } from "./metadata-view";
import { GenerationPanel } from "./generation-panel";
import { FolderDetail } from "./folder-detail";
import { useDriveStore } from "@/lib/store";

// DetailInspector(토글형) — 문서/폴더 양쪽 (arch 10 §8b)
// 패널 자체 닫기 버튼 없음: PC=row 재클릭 토글, 모바일=Sheet 닫기.
export const RightPanel = () => {
  const inspectedFolderId = useDriveStore((s) => s.inspectedFolderId);

  // 폴더 인스펙터 (단일 클릭) — 헤더 고정 + 아래 전체 스크롤
  if (inspectedFolderId) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center border-b px-3 py-2">
          <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            폴더 정보
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <FolderDetail />
        </div>
      </div>
    );
  }

  // 문서 인스펙터 — "문서 상세" 헤더만 고정, 아래(상세·버튼·메타 탭) 전체를 단일 스크롤
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center border-b px-3 py-2">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          문서 상세
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <DocumentDetail />

        <Separator />

        <Tabs defaultValue="meta" className="gap-0">
          <div className="px-3 pt-3">
            <TabsList className="w-full">
              <TabsTrigger value="meta" className="flex-1">
                메타데이터
              </TabsTrigger>
              <TabsTrigger value="gen" className="flex-1">
                산출물
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="meta">
            <MetadataView />
          </TabsContent>
          <TabsContent value="gen">
            <GenerationPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
