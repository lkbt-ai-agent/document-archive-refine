"use client";

import * as React from "react";
import { toast } from "sonner";
import { FolderNameDialog } from "@/components/drive/folder-name-dialog";
import { useUploadFiles } from "@/hooks/use-upload-files";
import { useFolders, useCreateFolder } from "@/lib/api/folders";
import { useDriveStore } from "@/lib/store";
import { errorMessage } from "@/lib/api/client";

// 폴더 추가 / 파일 추가 액션을 한 곳에서 제공한다(대상 폴더 = 인자).
// 헤더 "⋯" 메뉴와 빈 목록 우클릭 컨텍스트 메뉴가 동일 로직을 공유한다(frontend.md §10).
export const useArchiveActions = (folderId: string) => {
  const uploadFiles = useUploadFiles();
  const { data: folders = [] } = useFolders();
  const createFolder = useCreateFolder();
  const expandFolder = useDriveStore((s) => s.expandFolder);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [newOpen, setNewOpen] = React.useState(false);

  const parentName =
    folders.find((f) => f.id === folderId)?.name ?? "내 아카이브";

  // 메뉴 닫힘이 네이티브 파일창 클릭을 삼키지 않도록 한 틱 뒤 호출
  const openFilePicker = () => setTimeout(() => inputRef.current?.click(), 0);
  const openNewFolder = () => setNewOpen(true);

  // 호출부에서 트리(또는 인스펙터) 어딘가에 렌더해야 하는 숨은 input + 새 폴더 다이얼로그
  const elements = (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        accept=".pdf,image/*,.txt,.md,text/plain,text/markdown"
        onChange={(e) => {
          uploadFiles(folderId, e.target.files);
          e.target.value = ""; // 같은 파일 재선택 허용
        }}
      />
      {newOpen && (
        <FolderNameDialog
          key="new-folder"
          open={newOpen}
          onOpenChange={setNewOpen}
          title="새 폴더"
          description={`"${parentName}" 하위에 폴더를 만듭니다.`}
          initialName=""
          submitLabel="만들기"
          onSubmit={(name) =>
            createFolder.mutate(
              { parentId: folderId, name },
              {
                onSuccess: () => {
                  expandFolder(folderId);
                  toast.success(`"${name}" 폴더를 만들었습니다.`);
                },
                onError: (e) => toast.error(errorMessage(e)),
              },
            )
          }
        />
      )}
    </>
  );

  return { openFilePicker, openNewFolder, elements };
};
