import { DocumentList } from "@/components/drive/document-list";
import { ROOT_FOLDER_ID } from "@/lib/routes";

// "/my-archive" → 루트 폴더(내 아카이브)
const MyArchivePage = () => <DocumentList folderId={ROOT_FOLDER_ID} />;

export default MyArchivePage;
