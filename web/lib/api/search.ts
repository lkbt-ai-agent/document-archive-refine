import { useQuery } from "@tanstack/react-query";
import type { SearchMode } from "@/lib/types";
import { apiFetch } from "./client";
import type { AskResponseDTO, SearchResponseDTO } from "./dto";
import { qk } from "./keys";
import { mapAskCitations, mapSearchResult } from "./map";

// 키워드/의미 = POST /search(결과 리스트). rag 모드는 ask 훅으로 분리(search-frontend §1).
export const useSearch = (q: string, mode: SearchMode) =>
  useQuery({
    queryKey: qk.search(mode, q),
    enabled: !!q.trim() && mode !== "rag",
    queryFn: async () => {
      const res = await apiFetch<SearchResponseDTO>("/search", {
        method: "POST",
        body: { q, mode },
      });
      return {
        results: res.results.map(mapSearchResult),
        elapsedMs: res.elapsed_ms,
      };
    },
  });

// rag = POST /search/ask(합성 답변 + 인용).
export const useAsk = (q: string, mode: SearchMode) =>
  useQuery({
    queryKey: qk.search("rag", q),
    enabled: !!q.trim() && mode === "rag",
    queryFn: async () => {
      const res = await apiFetch<AskResponseDTO>("/search/ask", {
        method: "POST",
        body: { q },
      });
      return {
        answer: res.answer,
        citations: mapAskCitations(res),
        elapsedMs: res.elapsed_ms,
      };
    },
  });
