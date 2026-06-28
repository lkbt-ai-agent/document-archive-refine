import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { DocumentList } from "@/components/drive/document-list";
import { makeServerQueryClient } from "@/lib/api/server";
import { fetchDocumentsPage } from "@/lib/api/documents";
import { qk } from "@/lib/api/keys";
import { DEFAULT_LIST_SORT } from "@/lib/types";

// "/folders/{folderKey}" → 해당 폴더. ?doc={id} 딥링크 시 문서 인스펙터 동반. 첫 페이지를 서버에서 시드.
const FolderPage = async ({
  params,
  searchParams,
}: {
  params: Promise<{ folderKey: string }>;
  searchParams: Promise<{ doc?: string }>;
}) => {
  const { folderKey } = await params;
  const { doc } = await searchParams;

  const qc = makeServerQueryClient();
  try {
    await qc.prefetchInfiniteQuery({
      queryKey: qk.documents(folderKey, DEFAULT_LIST_SORT),
      queryFn: ({ pageParam }) =>
        fetchDocumentsPage(folderKey, pageParam, DEFAULT_LIST_SORT),
      initialPageParam: null as string | null,
    });
  } catch {
    /* 백엔드 미가동 — 클라이언트 재패치 */
  }

  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <DocumentList folderId={folderKey} docId={doc} />
    </HydrationBoundary>
  );
};

export default FolderPage;
