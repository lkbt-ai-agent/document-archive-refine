import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { ROOT_FOLDER_ID } from "@/lib/routes";
import {
  abortUpload,
  registerUpload,
  unregisterUpload,
} from "@/lib/upload-control";
import { apiFetch } from "./client";
import type {
  DocumentDTO,
  DownloadResponseDTO,
  PageDTO,
  UploadInitResponseDTO,
} from "./dto";
import { qk } from "./keys";
import { mapDocument } from "./map";
import type { DocumentItem, ListSort } from "@/lib/types";

const POLL_MS = 1500;

// 진행 중 문서가 있으면 목록을 폴링해 status/stage 갱신(ready/failed 정지) — document-frontend §3.
const hasInflight = (pages?: PageDTO<DocumentDTO>[]) =>
  pages?.some((p) =>
    p.items.some((d) => d.status === "processing" || d.status === "uploaded"),
  ) ?? false;

// 클라이언트 훅·서버 프리패치 공용 — 폴더별 문서 한 페이지(keyset cursor, sort).
export const fetchDocumentsPage = (
  folderId: string,
  cursor: string | null,
  sort: ListSort,
) =>
  apiFetch<PageDTO<DocumentDTO>>("/documents", {
    query: {
      folder_id: folderId === ROOT_FOLDER_ID ? undefined : folderId,
      cursor: cursor ?? undefined,
      sort,
      limit: 50,
    },
  });

export const useDocuments = (folderId: string, sort: ListSort, enabled = true) =>
  useInfiniteQuery({
    queryKey: qk.documents(folderId, sort),
    enabled,
    queryFn: ({ pageParam }) => fetchDocumentsPage(folderId, pageParam, sort),
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
    mutationFn: (id: string) => {
      abortUpload(id); // 진행 중 업로드 PUT 중단 — 늦은 PUT의 고아 오브젝트 방지(plan D14)
      return apiFetch<void>(`/documents/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["generations"] });
    },
  });
};

// 현재 파일명 변경(display_filename) — PATCH 부분 갱신. 목록·단건 캐시 낙관 갱신 후 롤백.
export const useRenameDocument = (folderId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; name: string }) =>
      apiFetch<DocumentDTO>(`/documents/${v.id}`, {
        method: "PATCH",
        body: { display_filename: v.name },
      }),
    onMutate: async (v) => {
      // 폴더의 모든 정렬 변형을 한꺼번에 다룬다(키에 sort 포함, documents-frontend).
      await qc.cancelQueries({ queryKey: qk.documentsByFolder(folderId) });
      await qc.cancelQueries({ queryKey: qk.document(v.id) });
      const prevLists = qc.getQueriesData<InfiniteData<PageDTO<DocumentDTO>>>({
        queryKey: qk.documentsByFolder(folderId),
      });
      const prevDoc = qc.getQueryData<DocumentItem>(qk.document(v.id));
      // 목록(DTO 페이지) 낙관 갱신 — 정렬별 캐시 모두
      qc.setQueriesData<InfiniteData<PageDTO<DocumentDTO>>>(
        { queryKey: qk.documentsByFolder(folderId) },
        (old) =>
          old
            ? {
                ...old,
                pages: old.pages.map((p) => ({
                  ...p,
                  items: p.items.map((d) =>
                    d.id === v.id ? { ...d, display_filename: v.name } : d,
                  ),
                })),
              }
            : old,
      );
      // 단건(매핑된 DocumentItem) 낙관 갱신
      qc.setQueryData<DocumentItem>(qk.document(v.id), (old) =>
        old ? { ...old, name: v.name } : old,
      );
      return { prevLists, prevDoc, id: v.id };
    },
    onError: (_e, _v, ctx) => {
      if (!ctx) return;
      ctx.prevLists.forEach(([key, data]) => qc.setQueryData(key, data));
      qc.setQueryData(qk.document(ctx.id), ctx.prevDoc);
    },
    onSettled: (_d, _e, v) => {
      qc.invalidateQueries({ queryKey: qk.documentsByFolder(folderId) });
      qc.invalidateQueries({ queryKey: qk.document(v.id) });
    },
  });
};

// 실패 문서 재시도 — POST /documents/{id}/retry. 상태를 낙관적으로 processing으로 돌려
// 폴링(useDocument/useDocuments refetchInterval)이 재개되게 한다. 실패 시 롤백한다.
export const useRetryDocument = (folderId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<DocumentDTO>(`/documents/${id}/retry`, { method: "POST" }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: qk.documentsByFolder(folderId) });
      await qc.cancelQueries({ queryKey: qk.document(id) });
      const prevLists = qc.getQueriesData<InfiniteData<PageDTO<DocumentDTO>>>({
        queryKey: qk.documentsByFolder(folderId),
      });
      const prevDoc = qc.getQueryData<DocumentItem>(qk.document(id));
      // 목록(DTO 페이지) 낙관 갱신 — 처리 중으로, 오류·단계 비움(정렬별 캐시 모두)
      qc.setQueriesData<InfiniteData<PageDTO<DocumentDTO>>>(
        { queryKey: qk.documentsByFolder(folderId) },
        (old) =>
          old
            ? {
                ...old,
                pages: old.pages.map((p) => ({
                  ...p,
                  items: p.items.map((d) =>
                    d.id === id
                      ? { ...d, status: "processing", stage: null, error: null }
                      : d,
                  ),
                })),
              }
            : old,
      );
      // 단건(매핑된 DocumentItem) 낙관 갱신
      qc.setQueryData<DocumentItem>(qk.document(id), (old) =>
        old
          ? { ...old, status: "processing", stage: undefined, error: undefined }
          : old,
      );
      return { prevLists, prevDoc, id };
    },
    onError: (_e, _id, ctx) => {
      if (!ctx) return;
      ctx.prevLists.forEach(([key, data]) => qc.setQueryData(key, data));
      qc.setQueryData(qk.document(ctx.id), ctx.prevDoc);
    },
    onSettled: (_d, _e, id) => {
      qc.invalidateQueries({ queryKey: qk.documentsByFolder(folderId) });
      qc.invalidateQueries({ queryKey: qk.document(id) });
    },
  });
};

// presigned PUT을 XHR로 전송해 업로드 진행률(%)을 추적한다.
// fetch는 진행률을 못 준다 — 스트리밍 업로드는 HTTP/2가 필요한데 브라우저는 평문 h2c 미지원이라
// http MinIO에선 HTTP/1.1로 고정된다(frontend.md §10). XHR.upload.onprogress 는 http·전 브라우저 OK.
const putWithProgress = (
  url: string,
  file: File,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
): Promise<void> =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    if (file.type) xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });
    xhr.addEventListener("load", () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error("업로드 전송 실패")),
    );
    xhr.addEventListener("error", () => reject(new Error("업로드 전송 실패")));
    // 취소(삭제) 시 진행 중 PUT 중단 — 명시 취소는 AbortError로 구분(토스트 생략용)
    xhr.addEventListener("abort", () => {
      const err = new Error("업로드 취소됨");
      err.name = "AbortError";
      reject(err);
    });
    if (signal) {
      if (signal.aborted) xhr.abort();
      else signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }
    xhr.send(file);
  });

export const useUpload = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      folderId: string;
      file: File;
      onInit?: (documentId: string) => void;
      onProgress?: (pct: number) => void;
    }) => {
      // 1) init → presigned PUT 발급, 2) 브라우저가 MinIO로 직접 PUT(진행률), 3) confirm → 인제스트 enqueue.
      const init = await apiFetch<UploadInitResponseDTO>("/documents", {
        method: "POST",
        body: {
          folder_id: v.folderId === ROOT_FOLDER_ID ? null : v.folderId,
          original_filename: v.file.name,
          mime_type: v.file.type || null,
          size_bytes: v.file.size,
        },
      });
      v.onInit?.(init.document_id); // 문서 id 확정 — 진행률 귀속·자동 선택용(frontend.md §10)
      // 진행 중 PUT을 docId로 취소 가능하게 등록 — 삭제/취소 시 고아 오브젝트 방지(plan D14)
      const controller = new AbortController();
      registerUpload(init.document_id, controller);
      try {
        await putWithProgress(
          init.upload_url,
          v.file,
          v.onProgress,
          controller.signal,
        );
        await apiFetch<DocumentDTO>(`/documents/${init.document_id}/complete`, {
          method: "POST",
        });
      } finally {
        unregisterUpload(init.document_id);
      }
      return init.document_id;
    },
    onSuccess: (_id, v) =>
      qc.invalidateQueries({ queryKey: qk.documentsByFolder(v.folderId) }),
  });
};

// 단건 문서 조회(매핑 포함) — 산출물/원본 폴더 이동 등 명령형 흐름용.
export const fetchDocument = async (id: string) =>
  mapDocument(await apiFetch<DocumentDTO>(`/documents/${id}`));

// presigned GET URL 발급(document-backend §3). 다운로드/원본보기 공용.
// inline=true면 인앱 미리보기용(`disposition=inline` → Content-Type 인라인 렌더, PDF/이미지).
export const fetchDownloadUrl = async (
  id: string,
  inline = false,
): Promise<string> =>
  (
    await apiFetch<DownloadResponseDTO>(`/documents/${id}/download`, {
      query: inline ? { disposition: "inline" } : undefined,
    })
  ).url;

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
