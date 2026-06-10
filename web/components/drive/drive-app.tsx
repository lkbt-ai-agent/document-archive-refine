"use client";

import { AppHeader } from "./app-header";
import { FolderTree } from "./folder-tree";
import { CenterPanel } from "./center-panel";
import { RightPanel } from "./right-panel";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useDriveStore } from "@/lib/store";
import { useIsMobile } from "@/hooks/use-is-mobile";

export const DriveApp = () => {
  const isMobile = useIsMobile();
  const mobileLeftOpen = useDriveStore((s) => s.mobileLeftOpen);
  const setMobileLeft = useDriveStore((s) => s.setMobileLeft);
  const mobileRightOpen = useDriveStore((s) => s.mobileRightOpen);
  const setMobileRight = useDriveStore((s) => s.setMobileRight);
  const selectDocument = useDriveStore((s) => s.selectDocument);
  // 우측 인스펙터는 문서 선택 시에만 노출(토글) — arch 10 §8b
  const inspectorOpen = useDriveStore((s) => s.selectedDocumentId != null);
  // 좌측 패널 접힘(PC) — 헤더 토글 (arch 10 §8b)
  const leftCollapsed = useDriveStore((s) => s.leftCollapsed);

  return (
    <div className="flex h-dvh flex-col">
      <AppHeader />

      {/* ≥md: Left 트리 + Center 목록 상시 + Right 인스펙터(토글) (PC·태블릿) */}
      <div className="hidden flex-1 overflow-hidden md:block">
        <ResizablePanelGroup orientation="horizontal">
          {!leftCollapsed && (
            <>
              <ResizablePanel
                id="left"
                defaultSize="20%"
                minSize="14%"
                maxSize="30%"
              >
                <FolderTree />
              </ResizablePanel>
              <ResizableHandle withHandle />
            </>
          )}
          <ResizablePanel
            id="center"
            defaultSize={inspectorOpen ? "52%" : "80%"}
            minSize="30%"
          >
            <CenterPanel />
          </ResizablePanel>
          {inspectorOpen && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel id="right" defaultSize="28%" minSize="18%" maxSize="40%">
                <RightPanel />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>

      {/* <md: 단일 패널 (모바일) */}
      <div className="flex-1 overflow-hidden md:hidden">
        <CenterPanel />
      </div>

      {/* 모바일 전용 오버레이 — 데스크톱에서는 마운트하지 않음(포털 회피) */}
      {isMobile && (
        <>
          <Sheet open={mobileLeftOpen} onOpenChange={setMobileLeft}>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>폴더</SheetTitle>
              </SheetHeader>
              <div className="h-full pt-2">
                <FolderTree />
              </div>
            </SheetContent>
          </Sheet>

          {/* 우측 인스펙터: 모바일은 바텀 시트가 아니라 전체 화면 Sheet(side=right).
              닫으면 선택 해제해 같은 row 재클릭 시 다시 열리도록 한다. */}
          <Sheet
            open={mobileRightOpen}
            onOpenChange={(open) => {
              setMobileRight(open);
              if (!open) selectDocument(null);
            }}
          >
            <SheetContent
              side="right"
              className="w-screen max-w-none gap-0 p-0 sm:max-w-none"
            >
              <SheetHeader className="sr-only">
                <SheetTitle>문서 상세</SheetTitle>
              </SheetHeader>
              <div className="h-full overflow-hidden">
                <RightPanel />
              </div>
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  );
};
