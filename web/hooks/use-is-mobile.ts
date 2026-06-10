"use client";

import * as React from "react";

const MOBILE_BREAKPOINT = 768; // Tailwind md

// arch 10 §12: <md = 모바일(단일 + Sheet/Drawer), ≥md = 3패널.
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
