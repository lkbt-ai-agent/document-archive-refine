import { create } from "zustand";
import { DEFAULT_LIST_SORT, type ListSort } from "@/lib/types";

// ── 상태 소유 경계 (frontend.md §4) ──────────────────────────────
// Zustand = 클라이언트 UI 상태(인스펙터 선택/하이라이트, 트리 확장, 패널 토글, 검색 입력)만 보관.
// 서버 데이터(폴더/문서/생성/검색)는 react-query(lib/api)가 소유한다.
// 폴더/검색 화면은 URL이 진실 소스. 테마는 next-themes 가 소유.

interface DriveState {
  selectedDocumentId: string | null; // 문서 인스펙터 대상(=인스펙터 열림)
  highlightedDocId: string | null; // 문서 단일 클릭 선택(하이라이트만)
  highlightedFolderId: string | null; // 폴더 단일 클릭 선택(하이라이트만)
  inspectedFolderId: string | null; // 폴더 인스펙터 대상(=인스펙터 열림)
  expandedFolderIds: string[];
  leftCollapsed: boolean; // PC(≥md) 좌측 패널 접힘(헤더 토글)
  mobileLeftOpen: boolean;
  mobileRightOpen: boolean;
  searchQuery: string; // SearchBar 입력값(실행/결과 화면은 URL이 소스)
  listSort: ListSort; // 목록 정렬(클라 세션 한정, 새로고침 시 기본값으로 초기화)
  uploadProgress: Record<string, number>; // 문서별 업로드 진행률(%) — 클라 세션 한정(frontend.md §10)

  selectDocument: (id: string | null) => void;
  highlightDocument: (id: string) => void;
  highlightFolder: (id: string) => void;
  inspectFolder: (id: string | null) => void;
  closeInspector: () => void;
  resetSelection: () => void; // 라우트 전환 시 인스펙터·하이라이트 모두 해제
  toggleFolder: (id: string) => void;
  expandFolder: (id: string) => void;
  toggleLeftCollapsed: () => void;
  setLeftCollapsed: (v: boolean) => void;
  setMobileLeft: (open: boolean) => void;
  setMobileRight: (open: boolean) => void;
  setSearchQuery: (q: string) => void;
  setListSort: (sort: ListSort) => void;
  setUploadProgress: (id: string, pct: number) => void;
  clearUploadProgress: (id: string) => void;
}

export const useDriveStore = create<DriveState>((set) => ({
  selectedDocumentId: null,
  highlightedDocId: null,
  highlightedFolderId: null,
  inspectedFolderId: null,
  expandedFolderIds: ["root"],
  leftCollapsed: false,
  mobileLeftOpen: false,
  mobileRightOpen: false,
  searchQuery: "",
  listSort: DEFAULT_LIST_SORT,
  uploadProgress: {},

  // 문서 인스펙터 열기(더블클릭/눈) — 다른 인스펙터·하이라이트 해제
  selectDocument: (id) =>
    set({
      selectedDocumentId: id,
      inspectedFolderId: null,
      highlightedDocId: null,
      highlightedFolderId: null,
    }),
  // 문서 단일 클릭 선택 — 인스펙터 닫혀 있으면 하이라이트만, 열려 있으면 닫지 말고 해당 문서로 갱신.
  highlightDocument: (id) =>
    set((s) => {
      const inspectorOpen =
        s.selectedDocumentId !== null || s.inspectedFolderId !== null;
      return inspectorOpen
        ? {
            selectedDocumentId: id,
            inspectedFolderId: null,
            highlightedDocId: null,
            highlightedFolderId: null,
          }
        : {
            highlightedDocId: id,
            highlightedFolderId: null,
            selectedDocumentId: null,
            inspectedFolderId: null,
          };
    }),
  // 폴더 단일 클릭 선택 — 인스펙터 닫혀 있으면 하이라이트만, 열려 있으면 닫지 말고 해당 폴더로 갱신.
  highlightFolder: (id) =>
    set((s) => {
      const inspectorOpen =
        s.selectedDocumentId !== null || s.inspectedFolderId !== null;
      return inspectorOpen
        ? {
            inspectedFolderId: id,
            selectedDocumentId: null,
            highlightedDocId: null,
            highlightedFolderId: null,
          }
        : {
            highlightedFolderId: id,
            highlightedDocId: null,
            selectedDocumentId: null,
            inspectedFolderId: null,
          };
    }),
  // 폴더 인스펙터 열기(눈) — 다른 인스펙터·하이라이트 해제
  inspectFolder: (id) =>
    set({
      inspectedFolderId: id,
      selectedDocumentId: null,
      highlightedDocId: null,
      highlightedFolderId: null,
    }),
  // 인스펙터 닫기(X·모바일 Sheet) — 직전 대상은 하이라이트로 남겨 선택 유지
  closeInspector: () =>
    set((s) => ({
      selectedDocumentId: null,
      inspectedFolderId: null,
      highlightedDocId: s.selectedDocumentId,
      highlightedFolderId: s.inspectedFolderId,
      mobileRightOpen: false,
    })),
  // 라우트 전환(폴더/검색 이동) — 인스펙터·하이라이트 일괄 해제
  resetSelection: () =>
    set({
      selectedDocumentId: null,
      inspectedFolderId: null,
      highlightedDocId: null,
      highlightedFolderId: null,
      mobileRightOpen: false,
    }),
  toggleFolder: (id) =>
    set((s) => ({
      expandedFolderIds: s.expandedFolderIds.includes(id)
        ? s.expandedFolderIds.filter((f) => f !== id)
        : [...s.expandedFolderIds, id],
    })),
  expandFolder: (id) =>
    set((s) =>
      s.expandedFolderIds.includes(id)
        ? s
        : { expandedFolderIds: [...s.expandedFolderIds, id] },
    ),
  toggleLeftCollapsed: () => set((s) => ({ leftCollapsed: !s.leftCollapsed })),
  setLeftCollapsed: (v) => set({ leftCollapsed: v }),
  setMobileLeft: (open) => set({ mobileLeftOpen: open }),
  setMobileRight: (open) => set({ mobileRightOpen: open }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setListSort: (sort) => set({ listSort: sort }),
  setUploadProgress: (id, pct) =>
    set((s) => ({ uploadProgress: { ...s.uploadProgress, [id]: pct } })),
  clearUploadProgress: (id) =>
    set((s) => {
      if (!(id in s.uploadProgress)) return s;
      const next = { ...s.uploadProgress };
      delete next[id];
      return { uploadProgress: next };
    }),
}));
