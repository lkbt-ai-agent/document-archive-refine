"use client";

import { AppHeader } from "./app-header";
import { FolderTree } from "./folder-tree";
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

// 공유 셸 — 라우트 전환 간 유지(트리·인스펙터 비리마운트). Center = 현재 라우트 page({children}).
export const DriveShell = ({ children }: { children: React.ReactNode }) => {
  const isMobile = useIsMobile();
  const mobileLeftOpen = useDriveStore((s) => s.mobileLeftOpen);
  const setMobileLeft = useDriveStore((s) => s.setMobileLeft);
  const mobileRightOpen = useDriveStore((s) => s.mobileRightOpen);
  const setMobileRight = useDriveStore((s) => s.setMobileRight);
  const closeInspector = useDriveStore((s) => s.closeInspector);
  // 우측 인스펙터는 문서/폴더 인스펙터 대상이 있을 때 노출
  const inspectorOpen = useDriveStore(
    (s) => s.selectedDocumentId != null || s.inspectedFolderId != null,
  );
  const leftCollapsed = useDriveStore((s) => s.leftCollapsed);

  return (
    <div className="flex h-dvh flex-col">
      <AppHeader />

      {/* ≥md: Left 트리 + Center(라우트) + Right 인스펙터(토글) */}
      <div className="hidden min-h-0 flex-1 overflow-hidden md:block">
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
            {children}
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
      <div className="min-h-0 flex-1 overflow-hidden md:hidden">{children}</div>

      {/* 모바일 전용 오버레이 — 데스크톱에서는 마운트하지 않음(포털 회피) */}
      {isMobile && (
        <>
          <Sheet open={mobileLeftOpen} onOpenChange={setMobileLeft}>
            <SheetContent side="left" showCloseButton={false} className="w-72 p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>폴더</SheetTitle>
              </SheetHeader>
              <div className="h-full pt-2">
                <FolderTree />
              </div>
            </SheetContent>
          </Sheet>

          {/* 우측 인스펙터: 모바일은 전체 화면 Sheet(side=right). 닫으면 인스펙터 해제(선택은 하이라이트로 유지). */}
          <Sheet
            open={mobileRightOpen}
            onOpenChange={(open) => {
              if (open) setMobileRight(true);
              else closeInspector();
            }}
          >
            <SheetContent
              side="right"
              showCloseButton={false}
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
