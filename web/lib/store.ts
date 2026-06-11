import { create } from "zustand";
import {
  mockDocuments,
  mockFolders,
  mockGenerations,
} from "./mock-data";
import type {
  DocStage,
  DocumentItem,
  Folder,
  GenKind,
  Generation,
} from "./types";

// ── 상태 소유 경계 (arch 10 §7) ──────────────────────────────
// Zustand = 클라이언트 UI 상태(선택/확장/모바일 패널/검색입력).
// documents·generations 는 본 프로토타입에서 "서버 데이터 스탠드인"(목업).
//   → 추후 react-query 로 이관, Zustand 에는 UI 상태만 남긴다.
// 테마는 next-themes 가 소유(여기 두지 않음).

const STAGES: DocStage[] = [
  "extracting",
  "generating_meta",
  "chunking",
  "embedding",
];

let idSeq = 100;
const nextId = () => `x${idSeq++}`;

// 폴더 후손 id 수집(자기 포함) — 이동 사이클 방지·재귀 삭제용 (arch 05 §6·§7).
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

interface DriveState {
  // 서버 데이터 스탠드인(목업)
  folders: Folder[];
  documents: DocumentItem[];
  generations: Generation[];

  // UI 상태
  selectedFolderId: string;
  selectedDocumentId: string | null; // 문서 인스펙터 대상(arch 10 §8b)
  inspectedFolderId: string | null; // 폴더 인스펙터 대상(폴더 단일클릭, arch 10 §7a). selectedDocumentId 와 상호배타
  expandedFolderIds: string[];
  leftCollapsed: boolean; // PC(≥md) 좌측 패널 접힘(헤더 토글, arch 10 §8b)
  mobileLeftOpen: boolean;
  mobileRightOpen: boolean;
  searchQuery: string;

  // actions — UI
  selectFolder: (id: string) => void;
  selectDocument: (id: string | null) => void;
  inspectFolder: (id: string | null) => void;
  toggleFolder: (id: string) => void;
  toggleLeftCollapsed: () => void;
  setLeftCollapsed: (v: boolean) => void;
  setMobileLeft: (open: boolean) => void;
  setMobileRight: (open: boolean) => void;
  setSearchQuery: (q: string) => void;

  // actions — 폴더 목업 mutation (arch 05)
  addFolder: (parentId: string | null, name: string) => void;
  renameFolder: (id: string, name: string) => void;
  moveFolder: (id: string, newParentId: string | null) => void;
  deleteFolder: (id: string) => void;

  // actions — 문서 목업 mutation(인터랙션 시뮬레이션)
  addUpload: (folderId: string, fileName: string, sizeBytes: number) => string;
  deleteDocument: (id: string) => void;
  startGeneration: (kind: GenKind, documentId: string) => void;
}

export const useDriveStore = create<DriveState>((set, get) => ({
  folders: mockFolders,
  documents: mockDocuments,
  generations: mockGenerations,

  selectedFolderId: "hr-salary",
  selectedDocumentId: null,
  inspectedFolderId: null,
  expandedFolderIds: ["root", "hr", "hr-salary", "reports"],
  leftCollapsed: false,
  mobileLeftOpen: false,
  mobileRightOpen: false,
  searchQuery: "",

  // 폴더 진입(네비게이션) — 인스펙터(문서/폴더) 모두 해제
  selectFolder: (id) =>
    set({ selectedFolderId: id, selectedDocumentId: null, inspectedFolderId: null }),
  // 문서 인스펙터 — 폴더 인스펙터와 상호배타
  selectDocument: (id) => set({ selectedDocumentId: id, inspectedFolderId: null }),
  // 폴더 인스펙터 — 문서 인스펙터와 상호배타
  inspectFolder: (id) => set({ inspectedFolderId: id, selectedDocumentId: null }),
  toggleFolder: (id) =>
    set((s) => ({
      expandedFolderIds: s.expandedFolderIds.includes(id)
        ? s.expandedFolderIds.filter((f) => f !== id)
        : [...s.expandedFolderIds, id],
    })),
  toggleLeftCollapsed: () => set((s) => ({ leftCollapsed: !s.leftCollapsed })),
  setLeftCollapsed: (v) => set({ leftCollapsed: v }),
  setMobileLeft: (open) => set({ mobileLeftOpen: open }),
  setMobileRight: (open) => set({ mobileRightOpen: open }),
  setSearchQuery: (q) => set({ searchQuery: q }),

  // 폴더 생성/이름변경/이동/삭제 (목업) — arch 05
  addFolder: (parentId, name) =>
    set((s) => {
      const id = nextId();
      return {
        folders: [
          ...s.folders,
          { id, parentId, name, createdAt: new Date().toISOString() },
        ],
        // 부모를 펼쳐 새 폴더가 보이도록
        expandedFolderIds:
          parentId && !s.expandedFolderIds.includes(parentId)
            ? [...s.expandedFolderIds, parentId]
            : s.expandedFolderIds,
      };
    }),

  renameFolder: (id, name) =>
    set((s) => ({
      folders: s.folders.map((f) => (f.id === id ? { ...f, name } : f)),
    })),

  moveFolder: (id, newParentId) =>
    set((s) => {
      // 사이클 방지: 대상이 자기 자신/후손이면 거부
      if (newParentId && collectSubtree(s.folders, id).has(newParentId)) {
        return s;
      }
      return {
        folders: s.folders.map((f) =>
          f.id === id ? { ...f, parentId: newParentId } : f,
        ),
      };
    }),

  deleteFolder: (id) =>
    set((s) => {
      const removed = collectSubtree(s.folders, id);
      const remainingDocs = s.documents.filter((d) => !removed.has(d.folderId));
      const liveDocIds = new Set(remainingDocs.map((d) => d.id));
      return {
        folders: s.folders.filter((f) => !removed.has(f.id)),
        documents: remainingDocs,
        // 삭제된 폴더 내 산출물 문서를 가리키던 생성의 링크 해제 → 산출물 내역 비노출
        generations: s.generations.map((g) =>
          g.outputDocumentId && !liveDocIds.has(g.outputDocumentId)
            ? { ...g, outputDocumentId: undefined }
            : g,
        ),
        selectedFolderId: removed.has(s.selectedFolderId)
          ? "root"
          : s.selectedFolderId,
        selectedDocumentId: null,
        inspectedFolderId: removed.has(s.inspectedFolderId ?? "")
          ? null
          : s.inspectedFolderId,
      };
    }),

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
      createdAt: new Date(0).toISOString(),
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
                      ingestMs: STAGES.length * 900,
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

  deleteDocument: (id) =>
    set((s) => ({
      documents: s.documents.filter((d) => d.id !== id),
      // 이 문서가 어떤 생성의 산출물이었다면 링크 해제 → 원본의 산출물 내역에서 사라짐
      generations: s.generations.map((g) =>
        g.outputDocumentId === id ? { ...g, outputDocumentId: undefined } : g,
      ),
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
          // 성공 시 산출물을 1급 문서로 materialize(원본과 같은 폴더) — arch 09 §9a
          set((s) => {
            const src = s.documents.find((d) => d.id === documentId);
            const outId = nextId();
            const kindLabel = { summary: "요약", draft: "초안", report: "보고서" }[
              kind
            ];
            const baseName = (src?.llmTitle ?? src?.name ?? "문서").replace(
              /\.[^.]+$/,
              "",
            );
            const outDoc: DocumentItem = {
              id: outId,
              folderId: src?.folderId ?? s.selectedFolderId,
              name: `[${kindLabel}] ${baseName}.md`,
              mime: "text/markdown",
              sizeBytes: 2_048,
              status: "ready",
              topics: [kindLabel],
              keywords: [kindLabel],
              llmTitle: `${baseName} — ${kindLabel}`,
              llmSummary: `AI가 생성한 ${kindLabel} 산출물 (목업).`,
              createdAt: new Date().toISOString(),
              ingestMs: 1_000,
            };
            return {
              documents: [outDoc, ...s.documents],
              generations: s.generations.map((g) =>
                g.id === id
                  ? {
                      ...g,
                      status: "succeeded",
                      progressPct: 100,
                      outputDocumentId: outId,
                      elapsedMs: 7_000,
                      // 계보 스냅샷(재현성) — 실제로는 worker가 provider/model/seed/렌더 프롬프트 기록(arch 09 §8)
                      sourceDocumentIds: [documentId],
                      model: "qwen2.5-14b-instruct-q5_k_m",
                      provider: "local",
                      seed: 42,
                      prompt: {
                        system:
                          "당신은 사내 문서 보관함의 산출물 생성 도우미입니다. 제공된 발췌만 근거로 사실에 기반해 답하고 [n] 인용을 답니다.",
                        user: `"${src?.name ?? "문서"}"를 근거로 ${kindLabel}을(를) 생성하세요.`,
                      },
                    }
                  : g,
              ),
            };
          });
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
