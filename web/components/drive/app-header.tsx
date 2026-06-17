"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useDriveStore } from "@/lib/store";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { PanelLeft } from "lucide-react";
import { ROOT_PATH } from "@/lib/routes";
import { SearchBar } from "./search-bar";
import { ThemeToggle } from "./theme-toggle";

export const AppHeader = () => {
  const setMobileLeft = useDriveStore((s) => s.setMobileLeft);
  const toggleLeftCollapsed = useDriveStore((s) => s.toggleLeftCollapsed);
  const isMobile = useIsMobile();
  const [searchFocused, setSearchFocused] = React.useState(false);

  // 모바일에서 검색 입력 포커스 시 다른 헤더 요소를 가려 입력 폭 확보(blur 시 원복)
  const hideForSearch = isMobile && searchFocused;

  // 좌측 패널 토글 — 모바일=Sheet 열기 / PC=패널 접기·펼치기
  const onToggleLeft = () => {
    if (isMobile) setMobileLeft(true);
    else toggleLeftCollapsed();
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-3">
      {!hideForSearch && (
        <>
          {/* 폴더 패널 토글 — 모바일=Sheet / PC=접기·펼치기 */}
          <Button
            variant="ghost"
            size="icon"
            aria-label="폴더 패널 토글"
            onClick={onToggleLeft}
          >
            <PanelLeft className="size-5" />
          </Button>

          {/* 로고 — 클릭 시 내 아카이브로. "Me"를 primary 배경 배지로 강조 */}
          <Link
            href={ROOT_PATH}
            aria-label="내 아카이브"
            className="flex items-center gap-2 font-semibold"
          >
            <span className="hidden items-center sm:inline-flex">
              <span className="rounded-md bg-primary p-[5px] leading-none text-primary-foreground">
                Me
              </span>
              <span className="ml-0.5">chive</span>
            </span>
          </Link>
        </>
      )}

      {/* 헤더 가운데 정렬된 통합 검색 진입 — SearchBar + 모드 드롭다운, 결과는 Center */}
      <div className="flex flex-1 justify-center">
        <SearchBar onFocusChange={setSearchFocused} />
      </div>

      {!hideForSearch && (
        <div className="flex items-center gap-1">
          <ThemeToggle />
        </div>
      )}
    </header>
  );
};
