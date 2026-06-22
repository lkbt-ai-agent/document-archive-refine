import { stageLabel, statusLabel } from "@/lib/format";
import type { DocStage, DocStatus } from "@/lib/types";

// 인제스트/업로드 진행 표시 모델 (frontend.md §11).
// 백엔드는 단계 내부 진척률을 노출하지 않는다(stage 이산, documents-schema·ingestion §2·§4).
// 따라서 status+stage를 단계 순서 percent로 프론트에서 파생한다.
// 단계 순서(ingestion §4): uploaded → extracting → generating_meta → chunking → embedding → ready.
const STAGE_PERCENT: Record<DocStage, number> = {
  extracting: 20,
  generating_meta: 40,
  chunking: 60,
  embedding: 80,
};

export interface IngestProgress {
  pct: number; // 0..100
  label: string; // 단계 캡션 (예: "추출 중", "업로드 중")
}

// 진행 바를 그릴 정보. ready/failed 등 터미널/비표시 상태면 null.
// uploadPct(클라 업로드 바이트 %)는 status가 uploaded일 때만 0–20% 구간에 매핑한다.
export const ingestProgress = (
  status: DocStatus,
  stage?: DocStage,
  uploadPct?: number,
): IngestProgress | null => {
  // 업로드 단계(서버 status=uploaded)에서만 클라 바이트 %를 표시한다.
  // 서버 상태가 uploaded를 벗어나면(processing/ready/failed) 잔존 uploadPct를 무시해
  // 완료 문서에 업로드 바가 남는 현상을 막는다(클라 세션 uploadProgress가 안 비워진 경우 방어).
  if (status === "uploaded") {
    if (typeof uploadPct === "number") {
      return { pct: Math.round(uploadPct * 0.2), label: "업로드 중" };
    }
    return { pct: 0, label: statusLabel.uploaded };
  }
  if (status === "processing") {
    const pct = stage ? STAGE_PERCENT[stage] : 10;
    return { pct, label: stage ? stageLabel[stage] : statusLabel.processing };
  }
  // ready(완료)·failed(실패)는 바를 표시하지 않는다(배지/에러 블록으로 충분).
  return null;
};
