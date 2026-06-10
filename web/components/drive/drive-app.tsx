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
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useDriveStore } from "@/lib/store";
import { useIsMobile } from "@/hooks/use-is-mobile";

export function DriveApp() {
  const isMobile = useIsMobile();
  const mobileLeftOpen = useDriveStore((s) => s.mobileLeftOpen);
  const setMobileLeft = useDriveStore((s) => s.setMobileLeft);
  const mobileRightOpen = useDriveStore((s) => s.mobileRightOpen);
  const setMobileRight = useDriveStore((s) => s.setMobileRight);

  return (
    <div className="flex h-dvh flex-col">
      <AppHeader />

      {/* ≥md: 3패널 (PC·태블릿) */}
      <div className="hidden flex-1 overflow-hidden md:block">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel defaultSize="20%" minSize="14%" maxSize="30%">
            <FolderTree />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize="52%" minSize="30%">
            <CenterPanel />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize="28%" minSize="18%" maxSize="40%">
            <RightPanel />
          </ResizablePanel>
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

          <Drawer open={mobileRightOpen} onOpenChange={setMobileRight}>
            <DrawerContent className="max-h-[85dvh]">
              <DrawerHeader className="sr-only">
                <DrawerTitle>메타데이터 / 생성</DrawerTitle>
              </DrawerHeader>
              <div className="h-[80dvh] overflow-hidden">
                <RightPanel />
              </div>
            </DrawerContent>
          </Drawer>
        </>
      )}
    </div>
  );
}
