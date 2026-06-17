import { DocumentList } from "@/components/drive/document-list";

// "/folders/{folderKey}" → 해당 폴더. ?doc={id} 딥링크 시 문서 인스펙터 동반.
const FolderPage = async ({
  params,
  searchParams,
}: {
  params: Promise<{ folderKey: string }>;
  searchParams: Promise<{ doc?: string }>;
}) => {
  const { folderKey } = await params;
  const { doc } = await searchParams;
  return <DocumentList folderId={folderKey} docId={doc} />;
};

export default FolderPage;
