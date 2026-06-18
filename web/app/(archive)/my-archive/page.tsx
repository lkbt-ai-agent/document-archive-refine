import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { DocumentList } from "@/components/drive/document-list";
import { makeServerQueryClient } from "@/lib/api/server";
import { fetchDocumentsPage } from "@/lib/api/documents";
import { qk } from "@/lib/api/keys";
import { ROOT_FOLDER_ID } from "@/lib/routes";

// "/my-archive" → 루트 폴더(내 아카이브). 첫 페이지를 서버에서 시드.
const MyArchivePage = async () => {
  const qc = makeServerQueryClient();
  try {
    await qc.prefetchInfiniteQuery({
      queryKey: qk.documents(ROOT_FOLDER_ID),
      queryFn: ({ pageParam }) => fetchDocumentsPage(ROOT_FOLDER_ID, pageParam),
      initialPageParam: null as string | null,
    });
  } catch {
    /* 백엔드 미가동 — 클라이언트 재패치 */
  }
  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <DocumentList folderId={ROOT_FOLDER_ID} />
    </HydrationBoundary>
  );
};

export default MyArchivePage;
