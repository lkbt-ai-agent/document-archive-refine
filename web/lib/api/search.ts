import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { API_URL } from "@/lib/config";
import type { Citation, SearchMode } from "@/lib/types";
import { apiFetch, errorMessage } from "./client";
import type { AskResponseDTO, CitationDTO, SearchResponseDTO } from "./dto";
import { qk } from "./keys";
import { mapAskCitations, mapCitation, mapSearchResult } from "./map";

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

// rag = POST /search/ask(합성 답변 + 인용). 비스트리밍 폴백(search-backend §5).
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

// rag 스트리밍 = POST /search/ask/stream(SSE). delta로 답변을 점진 수신하고 done에서 인용을 확정.
// phase: idle(대기 입력없음) · waiting(TTFT, 첫 토큰 전) · streaming · done · error.
export type AskPhase = "idle" | "waiting" | "streaming" | "done" | "error";

export interface AskStream {
  phase: AskPhase;
  text: string; // 진행 중 누적 텍스트, done 시 재번호된 최종 답변
  citations: Citation[]; // done 시에만 채워짐
  elapsedMs: number;
  error: string | null;
  stop: () => void;
}

export const useAskStream = (q: string, mode: SearchMode): AskStream => {
  const [state, setState] = React.useState<Omit<AskStream, "stop">>({
    phase: "idle",
    text: "",
    citations: [],
    elapsedMs: 0,
    error: null,
  });
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    if (!q.trim() || mode !== "rag") {
      setState({ phase: "idle", text: "", citations: [], elapsedMs: 0, error: null });
      return;
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setState({ phase: "waiting", text: "", citations: [], elapsedMs: 0, error: null });

    const run = async () => {
      try {
        const res = await fetch(`${API_URL}/search/ask/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) throw new Error(`스트리밍 실패 (${res.status})`);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let acc = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const events = buf.split("\n\n");
          buf = events.pop() ?? ""; // 마지막은 미완성일 수 있어 버퍼에 남긴다
          for (const ev of events) {
            const line = ev.split("\n").find((l) => l.startsWith("data:"));
            if (!line) continue;
            const obj = JSON.parse(line.slice("data:".length).trim());
            if (obj.type === "delta") {
              acc += obj.text as string;
              setState((s) => ({ ...s, phase: "streaming", text: acc }));
            } else if (obj.type === "done") {
              setState({
                phase: "done",
                text: obj.answer as string,
                citations: (obj.citations as CitationDTO[]).map(mapCitation),
                elapsedMs: obj.elapsed_ms as number,
                error: null,
              });
            }
          }
        }
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        setState((s) => ({ ...s, phase: "error", error: errorMessage(e) }));
      }
    };
    run();
    return () => ctrl.abort();
  }, [q, mode]);

  const stop = React.useCallback(() => abortRef.current?.abort(), []);
  return { ...state, stop };
};
