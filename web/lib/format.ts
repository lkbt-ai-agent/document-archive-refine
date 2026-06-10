import type { DocStage, DocStatus, GenKind, GenStatus } from "./types";

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(1)} ${units[i]}`;
};

// 결정적 포맷(SSR/CSR 동일) — 로케일 의존 회피로 hydration 안정.
export const formatDate = (iso: string): string => {
  const t = Date.parse(iso);
  if (!t) return "방금 전";
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
};

// 소요 시간(ms) → 초 표기. AI 성능 측정 표시용(arch 10 §11).
export const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)}초`;
};

export const statusLabel: Record<DocStatus, string> = {
  uploaded: "업로드됨",
  processing: "처리 중",
  ready: "완료",
  failed: "실패",
};

export const stageLabel: Record<DocStage, string> = {
  extracting: "추출",
  generating_meta: "메타 생성",
  chunking: "청킹",
  embedding: "임베딩",
};

export const genKindLabel: Record<GenKind, string> = {
  summary: "요약",
  draft: "초안",
  report: "보고서",
};

export const genStatusLabel: Record<GenStatus, string> = {
  queued: "대기",
  running: "진행 중",
  succeeded: "완료",
  failed: "실패",
};
