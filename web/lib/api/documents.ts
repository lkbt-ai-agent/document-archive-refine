import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ROOT_FOLDER_ID } from "@/lib/routes";
import { apiFetch } from "./client";
import type {
  DocumentDTO,
  DownloadResponseDTO,
  PageDTO,
  UploadInitResponseDTO,
} from "./dto";
import { qk } from "./keys";
import { mapDocument } from "./map";

const POLL_MS = 1500;

// 진행 중 문서가 있으면 목록을 폴링해 status/stage 갱신(ready/failed 정지) — document-frontend §3.
const hasInflight = (pages?: PageDTO<DocumentDTO>[]) =>
  pages?.some((p) =>
    p.items.some((d) => d.status === "processing" || d.status === "uploaded"),
  ) ?? false;

// 클라이언트 훅·서버 프리패치 공용 — 폴더별 문서 한 페이지(keyset cursor).
export const fetchDocumentsPage = (folderId: string, cursor: string | null) =>
  apiFetch<PageDTO<DocumentDTO>>("/documents", {
    query: {
      folder_id: folderId === ROOT_FOLDER_ID ? undefined : folderId,
      cursor: cursor ?? undefined,
      limit: 50,
    },
  });

export const useDocuments = (folderId: string, enabled = true) =>
  useInfiniteQuery({
    queryKey: qk.documents(folderId),
    enabled,
    queryFn: ({ pageParam }) => fetchDocumentsPage(folderId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    refetchInterval: (query) =>
      hasInflight(query.state.data?.pages) ? POLL_MS : false,
  });

export const useDocument = (id: string | null) =>
  useQuery({
    queryKey: qk.document(id ?? "none"),
    enabled: !!id,
    queryFn: async () =>
      mapDocument(await apiFetch<DocumentDTO>(`/documents/${id}`)),
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === "processing" || s === "uploaded" ? POLL_MS : false;
    },
  });

export const useDeleteDocument = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/documents/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["generations"] });
    },
  });
};

export const useUpload = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { folderId: string; file: File }) => {
      // 1) init → presigned PUT 발급, 2) 브라우저가 MinIO로 직접 PUT, 3) confirm → 인제스트 enqueue.
      const init = await apiFetch<UploadInitResponseDTO>("/documents", {
        method: "POST",
        body: {
          folder_id: v.folderId === ROOT_FOLDER_ID ? null : v.folderId,
          original_filename: v.file.name,
          mime_type: v.file.type || null,
          size_bytes: v.file.size,
        },
      });
      const put = await fetch(init.upload_url, {
        method: "PUT",
        body: v.file,
        headers: v.file.type ? { "Content-Type": v.file.type } : {},
      });
      if (!put.ok) throw new Error("업로드 전송 실패");
      await apiFetch<DocumentDTO>(`/documents/${init.document_id}/complete`, {
        method: "POST",
      });
      return init.document_id;
    },
    onSuccess: (_id, v) =>
      qc.invalidateQueries({ queryKey: qk.documents(v.folderId) }),
  });
};

// 단건 문서 조회(매핑 포함) — 산출물/원본 폴더 이동 등 명령형 흐름용.
export const fetchDocument = async (id: string) =>
  mapDocument(await apiFetch<DocumentDTO>(`/documents/${id}`));

// presigned GET URL 발급(document-backend §3). 다운로드/원본보기 공용.
export const fetchDownloadUrl = async (id: string): Promise<string> =>
  (await apiFetch<DownloadResponseDTO>(`/documents/${id}/download`)).url;

// 브라우저 다운로드 트리거 — presigned GET은 Content-Disposition attachment(RFC 5987).
export const triggerDownload = async (id: string): Promise<void> => {
  const url = await fetchDownloadUrl(id);
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
};

// 텍스트류 원본 본문을 받아 마크다운 뷰어에 표시(그 외 타입은 다운로드로 분기).
export const fetchOriginalText = async (id: string): Promise<string> => {
  const url = await fetchDownloadUrl(id);
  const res = await fetch(url);
  if (!res.ok) throw new Error("원본을 불러오지 못했습니다.");
  return res.text();
};
