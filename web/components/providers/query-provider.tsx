"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// react-query 1차 데이터 레이어(frontend.md §3). 클라이언트 인스턴스는 요청 간 공유하되
// SSR 누수 방지를 위해 컴포넌트 인스턴스 단위로 생성한다.
export const QueryProvider = ({ children }: { children: React.ReactNode }) => {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};
