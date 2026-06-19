"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useUpload } from "@/lib/api/documents";
import { qk } from "@/lib/api/keys";
import { errorMessage } from "@/lib/api/client";
import { useDriveStore } from "@/lib/store";

// 파일 목록을 presigned 3단계로 업로드한다. 진행률(%)은 토스트가 아니라 인스펙터 메타데이터 탭에
// 표시한다(Zustand uploadProgress, frontend.md §10). 완료/실패만 토스트로 알린다.
// 헤더 "⋯" 메뉴·빈 목록 컨텍스트 메뉴·UploadDropzone가 공유한다.
export const useUploadFiles = () => {
  const upload = useUpload();
  const qc = useQueryClient();
  const setUploadProgress = useDriveStore((s) => s.setUploadProgress);
  const clearUploadProgress = useDriveStore((s) => s.clearUploadProgress);
  const selectDocument = useDriveStore((s) => s.selectDocument);
  const setMobileRight = useDriveStore((s) => s.setMobileRight);

  return (folderId: string, files: FileList | File[] | null) => {
    const list = files ? Array.from(files) : [];
    const autoSelect = list.length === 1; // B안: 단일 파일이면 업로드 문서를 자동 선택해 진행률 노출

    list.forEach((file) => {
      let docId: string | null = null;
      upload.mutate(
        {
          folderId,
          file,
          onInit: (id) => {
            docId = id;
            setUploadProgress(id, 0);
            // 업로드 중 문서를 목록에 즉시 노출(status uploaded)
            qc.invalidateQueries({ queryKey: qk.documents(folderId) });
            if (autoSelect) {
              selectDocument(id);
              setMobileRight(true);
            }
          },
          onProgress: (pct) => {
            if (docId) setUploadProgress(docId, pct);
          },
        },
        {
          onSuccess: () => {
            if (docId) clearUploadProgress(docId);
            toast.success(`"${file.name}" 업로드 완료 — 인제스트 시작`);
          },
          onError: (e) => {
            if (docId) clearUploadProgress(docId);
            // 사용자가 취소(삭제)해 PUT이 중단된 경우엔 별도 에러 토스트를 띄우지 않는다(plan D14)
            if (e instanceof Error && e.name === "AbortError") return;
            toast.error(errorMessage(e));
          },
        },
      );
    });
  };
};
