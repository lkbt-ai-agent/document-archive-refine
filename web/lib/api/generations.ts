import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { GenKind } from "@/lib/types";
import { apiFetch } from "./client";
import type {
  ArtifactListItemDTO,
  GenerationDTO,
  LineageResponseDTO,
} from "./dto";
import { qk } from "./keys";
import { mapGeneration, mapLineage } from "./map";

const POLL_MS = 2000;

// 산출물 내역 — 원본 기준, 출력 문서가 존재하는 생성만(ai-outputs-backend §1, 백엔드가 필터).
export const useArtifacts = (sourceDocumentId: string | null) =>
  useQuery({
    queryKey: qk.artifacts(sourceDocumentId ?? "none"),
    enabled: !!sourceDocumentId,
    queryFn: () =>
      apiFetch<ArtifactListItemDTO[]>("/generations", {
        query: { source_document_id: sourceDocumentId ?? undefined },
      }),
  });

// 전체 산출물(출력 문서 보유) — 산출물 문서 → 생성 id 역조회용(계보 섹션 판별).
export const useGenerationIdByOutput = (outputDocId: string | null) =>
  useQuery({
    queryKey: qk.allArtifacts,
    enabled: !!outputDocId,
    queryFn: () => apiFetch<ArtifactListItemDTO[]>("/generations"),
    select: (rows) =>
      rows.find((r) => r.output_document_id === outputDocId)?.id ?? null,
  });

export const useCreateGeneration = () =>
  useMutation({
    mutationFn: (v: { kind: GenKind; documentId: string }) =>
      apiFetch<GenerationDTO>("/generations", {
        method: "POST",
        body: { kind: v.kind, document_ids: [v.documentId] },
      }),
  });

// 진행 폴링 — queued/running 동안만. 종료 시 정지.
export const useGeneration = (id: string | null) =>
  useQuery({
    queryKey: qk.generation(id ?? "none"),
    enabled: !!id,
    queryFn: async () =>
      mapGeneration(await apiFetch<GenerationDTO>(`/generations/${id}`)),
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === "queued" || s === "running" ? POLL_MS : false;
    },
  });

export const useLineage = (generationId: string | null) =>
  useQuery({
    queryKey: qk.lineage(generationId ?? "none"),
    enabled: !!generationId,
    queryFn: async () =>
      mapLineage(
        await apiFetch<LineageResponseDTO>(
          `/generations/${generationId}/lineage`,
        ),
      ),
  });

// 생성 완료 후 관련 캐시 무효화(산출물 내역·문서 목록·역조회 갱신).
export const useInvalidateGenerations = () => {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["generations"] });
    qc.invalidateQueries({ queryKey: ["documents"] });
  };
};
