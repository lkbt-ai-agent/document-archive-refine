import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ROOT_FOLDER_ID } from "@/lib/routes";
import type { Folder } from "@/lib/types";
import { apiFetch } from "./client";
import type { FolderDTO } from "./dto";
import { qk } from "./keys";
import { mapFolders } from "./map";

// 가상 루트 → 백엔드 NULL 부모 변환.
const toApiParent = (parentId: string | null): string | null =>
  parentId === ROOT_FOLDER_ID || parentId === null ? null : parentId;

// 자기 + 후손 id 수집(낙관 삭제/사이클 방지용).
const collectSubtree = (folders: Folder[], rootId: string): Set<string> => {
  const childrenOf = new Map<string | null, Folder[]>();
  for (const f of folders) {
    const arr = childrenOf.get(f.parentId) ?? [];
    arr.push(f);
    childrenOf.set(f.parentId, arr);
  }
  const ids = new Set<string>();
  const walk = (id: string) => {
    ids.add(id);
    for (const c of childrenOf.get(id) ?? []) walk(c.id);
  };
  walk(rootId);
  return ids;
};

// 클라이언트 훅·서버 프리패치(HydrationBoundary) 공용 쿼리 함수.
export const fetchFolders = async () =>
  mapFolders(await apiFetch<FolderDTO[]>("/folders"));

export const useFolders = () =>
  useQuery({ queryKey: qk.folders, queryFn: fetchFolders });

// 낙관 업데이트 공통 헬퍼 — folders 캐시를 patch 후 실패 시 롤백, 완료 시 무효화.
const useOptimisticFolders = () => {
  const qc = useQueryClient();
  return {
    qc,
    patch: async (fn: (prev: Folder[]) => Folder[]) => {
      await qc.cancelQueries({ queryKey: qk.folders });
      const prev = qc.getQueryData<Folder[]>(qk.folders);
      if (prev) qc.setQueryData<Folder[]>(qk.folders, fn(prev));
      return { prev };
    },
    rollback: (ctx?: { prev?: Folder[] }) => {
      if (ctx?.prev) qc.setQueryData(qk.folders, ctx.prev);
    },
  };
};

export const useCreateFolder = () => {
  const { qc, patch, rollback } = useOptimisticFolders();
  return useMutation({
    mutationFn: (v: { parentId: string | null; name: string }) =>
      apiFetch<FolderDTO>("/folders", {
        method: "POST",
        body: { parent_id: toApiParent(v.parentId), name: v.name },
      }),
    onMutate: (v) =>
      patch((prev) => [
        ...prev,
        {
          id: `tmp-${prev.length}-${v.name}`,
          parentId: v.parentId ?? ROOT_FOLDER_ID,
          name: v.name,
          createdAt: new Date().toISOString(),
        },
      ]),
    onError: (_e, _v, ctx) => rollback(ctx),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.folders }),
  });
};

export const useRenameFolder = () => {
  const { qc, patch, rollback } = useOptimisticFolders();
  return useMutation({
    mutationFn: (v: { id: string; name: string }) =>
      apiFetch<FolderDTO>(`/folders/${v.id}`, {
        method: "PATCH",
        body: { name: v.name },
      }),
    onMutate: (v) =>
      patch((prev) =>
        prev.map((f) => (f.id === v.id ? { ...f, name: v.name } : f)),
      ),
    onError: (_e, _v, ctx) => rollback(ctx),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.folders }),
  });
};

export const useMoveFolder = () => {
  const { qc, patch, rollback } = useOptimisticFolders();
  return useMutation({
    mutationFn: (v: { id: string; parentId: string | null }) =>
      apiFetch<FolderDTO>(`/folders/${v.id}`, {
        method: "PATCH",
        body: { parent_id: toApiParent(v.parentId) },
      }),
    onMutate: (v) =>
      patch((prev) =>
        prev.map((f) =>
          f.id === v.id ? { ...f, parentId: v.parentId ?? ROOT_FOLDER_ID } : f,
        ),
      ),
    onError: (_e, _v, ctx) => rollback(ctx),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.folders }),
  });
};

export const useDeleteFolder = () => {
  const { qc, patch, rollback } = useOptimisticFolders();
  return useMutation({
    mutationFn: (v: { id: string }) =>
      apiFetch<void>(`/folders/${v.id}`, { method: "DELETE" }),
    onMutate: (v) =>
      patch((prev) => {
        const removed = collectSubtree(prev, v.id);
        return prev.filter((f) => !removed.has(f.id));
      }),
    onError: (_e, _v, ctx) => rollback(ctx),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.folders });
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["generations"] });
    },
  });
};
