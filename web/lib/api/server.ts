import "server-only";
import { QueryClient } from "@tanstack/react-query";

// 서버 컴포넌트 프리패치용 QueryClient(요청마다 새로 생성) — dehydrate → HydrationBoundary 로 시드.
export const makeServerQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000 } },
  });
