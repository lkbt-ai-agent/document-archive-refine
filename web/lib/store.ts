import { create } from "zustand";
import {
  mockDocuments,
  mockGenerations,
} from "./mock-data";
import type {
  DocStage,
  DocumentItem,
  GenKind,
  Generation,
} from "./types";

// ── 상태 소유 경계 (arch 10 §7 / plan 1.3) ──────────────────────────────
// Zustand = 클라이언트 UI 상태(선택/확장/모바일 패널/검색입력).
// documents·generations 는 본 프로토타입에서 "서버 데이터 스탠드인"(목업).
//   → Phase 4에서 react-query 로 이관, Zustand 에는 UI 상태만 남긴다.
// 테마는 next-themes 가 소유(여기 두지 않음).

const STAGES: DocStage[] = [
  "extracting",
  "generating_meta",
  "chunking",
  "embedding",
];

let idSeq = 100;
const nextId = () => `x${idSeq++}`;

interface DriveState {
  // 서버 데이터 스탠드인(목업)
  documents: DocumentItem[];
  generations: Generation[];

  // UI 상태
  selectedFolderId: string;
  selectedDocumentId: string | null;
  expandedFolderIds: string[];
  mobileLeftOpen: boolean;
  mobileRightOpen: boolean;
  searchQuery: string;
  searchMode: "keyword" | "semantic" | "rag";

  // actions — UI
  selectFolder: (id: string) => void;
  selectDocument: (id: string | null) => void;
  toggleFolder: (id: string) => void;
  setMobileLeft: (open: boolean) => void;
  setMobileRight: (open: boolean) => void;
  setSearchQuery: (q: string) => void;
  setSearchMode: (m: DriveState["searchMode"]) => void;

  // actions — 목업 mutation(인터랙션 시뮬레이션)
  addUpload: (folderId: string, fileName: string, sizeBytes: number) => string;
  updateDocMeta: (
    id: string,
    patch: Partial<Pick<DocumentItem, "llmTitle" | "llmSummary" | "topics" | "keywords">>,
  ) => void;
  deleteDocument: (id: string) => void;
  startGeneration: (kind: GenKind, documentId: string) => void;
}

export const useDriveStore = create<DriveState>((set, get) => ({
  documents: mockDocuments,
  generations: mockGenerations,

  selectedFolderId: "hr-salary",
  selectedDocumentId: "d1",
  expandedFolderIds: ["root", "hr", "hr-salary", "reports"],
  mobileLeftOpen: false,
  mobileRightOpen: false,
  searchQuery: "",
  searchMode: "rag",

  selectFolder: (id) => set({ selectedFolderId: id, selectedDocumentId: null }),
  selectDocument: (id) => set({ selectedDocumentId: id }),
  toggleFolder: (id) =>
    set((s) => ({
      expandedFolderIds: s.expandedFolderIds.includes(id)
        ? s.expandedFolderIds.filter((f) => f !== id)
        : [...s.expandedFolderIds, id],
    })),
  setMobileLeft: (open) => set({ mobileLeftOpen: open }),
  setMobileRight: (open) => set({ mobileRightOpen: open }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setSearchMode: (m) => set({ searchMode: m }),

  // 업로드 3단계 시뮬레이션: uploaded → processing(stage 진행) → ready
  addUpload: (folderId, fileName, sizeBytes) => {
    const id = nextId();
    const doc: DocumentItem = {
      id,
      folderId,
      name: fileName,
      mime: "application/octet-stream",
      sizeBytes,
      status: "uploaded",
      topics: [],
      keywords: [],
      progress: 0,
      updatedAt: new Date(0).toISOString(),
    };
    set((s) => ({ documents: [doc, ...s.documents] }));

    // ② Upload 진행률 → ③ Confirm(processing) → stage 폴링 → ready
    let pct = 0;
    const upTimer = setInterval(() => {
      pct += 25;
      set((s) => ({
        documents: s.documents.map((d) =>
          d.id === id ? { ...d, progress: Math.min(pct, 100) } : d,
        ),
      }));
      if (pct >= 100) {
        clearInterval(upTimer);
        set((s) => ({
          documents: s.documents.map((d) =>
            d.id === id
              ? { ...d, status: "processing", stage: STAGES[0], progress: 0 }
              : d,
          ),
        }));
        let stageIdx = 0;
        const stageTimer = setInterval(() => {
          stageIdx += 1;
          if (stageIdx >= STAGES.length) {
            clearInterval(stageTimer);
            set((s) => ({
              documents: s.documents.map((d) =>
                d.id === id
                  ? {
                      ...d,
                      status: "ready",
                      stage: undefined,
                      progress: undefined,
                      llmTitle: fileName.replace(/\.[^.]+$/, ""),
                      llmSummary: "(자동 생성된 요약 — 목업)",
                      topics: ["자동분류"],
                      keywords: ["샘플"],
                    }
                  : d,
              ),
            }));
          } else {
            set((s) => ({
              documents: s.documents.map((d) =>
                d.id === id ? { ...d, stage: STAGES[stageIdx] } : d,
              ),
            }));
          }
        }, 900);
      }
    }, 500);

    return id;
  },

  updateDocMeta: (id, patch) =>
    set((s) => ({
      documents: s.documents.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    })),

  deleteDocument: (id) =>
    set((s) => ({
      documents: s.documents.filter((d) => d.id !== id),
      selectedDocumentId:
        s.selectedDocumentId === id ? null : s.selectedDocumentId,
    })),

  // 비동기 생성 시뮬레이션: queued → running(진행률) → succeeded
  startGeneration: (kind, documentId) => {
    const doc = get().documents.find((d) => d.id === documentId);
    const id = nextId();
    const gen: Generation = {
      id,
      kind,
      status: "queued",
      progressPct: 0,
      documentId,
      documentName: doc?.name ?? "(문서)",
      createdAt: new Date(0).toISOString(),
    };
    set((s) => ({ generations: [gen, ...s.generations] }));

    setTimeout(() => {
      set((s) => ({
        generations: s.generations.map((g) =>
          g.id === id ? { ...g, status: "running" } : g,
        ),
      }));
      let pct = 0;
      const t = setInterval(() => {
        pct += 20;
        if (pct >= 100) {
          clearInterval(t);
          set((s) => ({
            generations: s.generations.map((g) =>
              g.id === id ? { ...g, status: "succeeded", progressPct: 100 } : g,
            ),
          }));
        } else {
          set((s) => ({
            generations: s.generations.map((g) =>
              g.id === id ? { ...g, progressPct: pct } : g,
            ),
          }));
        }
      }, 700);
    }, 600);
  },
}));
