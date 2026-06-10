"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

// arch 10 §3: 시스템 추종 + 수동 토글, class 전략, FOUC 방지(layout 의 suppressHydrationWarning).
export const ThemeProvider = ({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) => {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
};
