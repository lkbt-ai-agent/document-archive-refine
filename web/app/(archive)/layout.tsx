import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { DriveShell } from "@/components/drive/drive-shell";
import { makeServerQueryClient } from "@/lib/api/server";
import { fetchFolders } from "@/lib/api/folders";
import { qk } from "@/lib/api/keys";

// 백엔드 데이터에 의존하므로 빌드 시 정적 생성하지 않는다(요청 시 렌더).
export const dynamic = "force-dynamic";

// 공유 셸 layout — `/my-archive`, `/folders/[folderKey]`, `/search` 전반에서 유지.
// 폴더 트리는 셸 상시 노출이라 서버에서 미리 패치해 HydrationBoundary 로 시드한다(frontend.md §3).
const DriveLayout = async ({ children }: { children: React.ReactNode }) => {
  const qc = makeServerQueryClient();
  try {
    await qc.prefetchQuery({ queryKey: qk.folders, queryFn: fetchFolders });
  } catch {
    // 백엔드 미가동 등 — 클라이언트가 다시 패치한다.
  }
  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <DriveShell>{children}</DriveShell>
    </HydrationBoundary>
  );
};

export default DriveLayout;
