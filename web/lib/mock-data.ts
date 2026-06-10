import type {
  Citation,
  DocumentItem,
  Folder,
  Generation,
  SearchResultItem,
} from "./types";

// 백엔드 미연동 — 모든 데이터는 목업. 추후 실 API(react-query)로 교체.

export const mockFolders: Folder[] = [
  { id: "root", parentId: null, name: "내 보관함" },
  { id: "hr", parentId: "root", name: "인사" },
  { id: "hr-salary", parentId: "hr", name: "급여" },
  { id: "hr-contract", parentId: "hr", name: "계약" },
  { id: "acct", parentId: "root", name: "회계" },
  { id: "reports", parentId: "root", name: "보고서" },
  { id: "reports-2025", parentId: "reports", name: "2025" },
];

export const mockDocuments: DocumentItem[] = [
  {
    id: "d1",
    folderId: "hr-salary",
    name: "2025_연봉계약서.pdf",
    mime: "application/pdf",
    sizeBytes: 482_113,
    status: "ready",
    topics: ["연봉", "계약"],
    keywords: ["연봉", "기본급", "성과급", "2025"],
    pageCount: 3,
    author: "인사팀",
    llmTitle: "2025년도 연봉계약서",
    llmSummary:
      "2025년 기본급 및 성과급 구성, 지급 일정과 복리후생 항목을 정리한 연봉계약서.",
    createdAt: "2026-06-08T09:12:00Z",
  },
  {
    id: "d2",
    folderId: "hr-salary",
    name: "2024_연봉계약서.pdf",
    mime: "application/pdf",
    sizeBytes: 461_220,
    status: "ready",
    topics: ["연봉"],
    keywords: ["연봉", "2024"],
    pageCount: 3,
    author: "인사팀",
    llmTitle: "2024년도 연봉계약서",
    llmSummary: "2024년 연봉 구성 및 지급 조건.",
    createdAt: "2025-06-07T03:20:00Z",
  },
  {
    id: "d3",
    folderId: "reports-2025",
    name: "1분기_실적보고.pdf",
    mime: "application/pdf",
    sizeBytes: 1_204_882,
    status: "processing",
    stage: "embedding",
    progress: 72,
    topics: ["실적", "분기"],
    keywords: ["매출", "영업이익"],
    pageCount: 18,
    createdAt: "2026-06-10T01:02:00Z",
  },
  {
    id: "d4",
    folderId: "reports-2025",
    name: "스캔본_회의록.pdf",
    mime: "application/pdf",
    sizeBytes: 3_882_001,
    status: "failed",
    error: "OCR 부분 실패: 7페이지 인식 불가",
    topics: [],
    keywords: [],
    pageCount: 12,
    createdAt: "2026-06-09T22:41:00Z",
  },
  {
    id: "d5",
    folderId: "acct",
    name: "거래내역_2025.csv.txt",
    mime: "text/plain",
    sizeBytes: 84_220,
    status: "uploaded",
    topics: [],
    keywords: [],
    createdAt: "2026-06-10T02:55:00Z",
  },
  {
    id: "d6",
    folderId: "hr-contract",
    name: "표준근로계약서.md",
    mime: "text/markdown",
    sizeBytes: 12_005,
    status: "ready",
    topics: ["계약", "근로"],
    keywords: ["근로계약", "표준"],
    llmTitle: "표준근로계약서",
    llmSummary: "근로조건·임금·근로시간을 규정한 표준 근로계약서 양식.",
    createdAt: "2026-05-30T11:10:00Z",
  },
];

export const mockGenerations: Generation[] = [
  {
    id: "g1",
    kind: "summary",
    status: "succeeded",
    progressPct: 100,
    documentId: "d1",
    documentName: "2025_연봉계약서.pdf",
    createdAt: "2026-06-09T10:00:00Z",
  },
  {
    id: "g2",
    kind: "report",
    status: "running",
    progressPct: 45,
    documentId: "d3",
    documentName: "1분기_실적보고.pdf",
    createdAt: "2026-06-10T03:00:00Z",
  },
  {
    id: "g3",
    kind: "draft",
    status: "queued",
    progressPct: 0,
    documentId: "d6",
    documentName: "표준근로계약서.md",
    createdAt: "2026-06-10T03:05:00Z",
  },
];

export const mockSearchResults: SearchResultItem[] = [
  {
    documentId: "d1",
    documentName: "2025_연봉계약서.pdf",
    title: "2025년도 연봉계약서",
    snippet:
      "…2025년 기본급은 전년 대비 5% 인상되며, 성과급은 분기별 평가 결과에 따라…",
    score: 0.91,
  },
  {
    documentId: "d2",
    documentName: "2024_연봉계약서.pdf",
    title: "2024년도 연봉계약서",
    snippet: "…2024년 연봉 총액 및 지급 일정은 다음과 같다…",
    score: 0.78,
  },
  {
    documentId: "d6",
    documentName: "표준근로계약서.md",
    title: "표준근로계약서",
    snippet: "…임금은 매월 25일 지급하며, 근로시간은 주 40시간을 원칙으로…",
    score: 0.52,
  },
];

// "원본 보기" 마크다운 뷰어용 텍스트류 원본(목업). 텍스트 문서만 인앱 열람, 그 외는 다운로드.
export const mockOriginalText: Record<string, string> = {
  d5: `거래일자, 적요, 입금, 출금, 잔액
2025-01-03, 급여이체, 3,200,000, , 5,120,000
2025-01-12, 카드대금, , 480,000, 4,640,000
2025-01-25, 이자, 1,250, , 4,641,250
…(텍스트 원본 — 일부 발췌)`,
  d6: `# 표준근로계약서

본 계약은 **사용자**와 **근로자** 간 근로조건을 정한다.

## 1. 근로시간
- 1일 8시간, 주 40시간을 원칙으로 한다.
- 휴게시간은 근로시간 4시간당 30분 이상 부여한다.

## 2. 임금
| 항목 | 내용 |
| --- | --- |
| 지급일 | 매월 25일 |
| 지급방법 | 근로자 명의 계좌 이체 |

> 본 양식은 표준근로계약서 예시이며, 실제 계약 시 법령을 확인한다.
`,
};

export const mockAskAnswer = {
  answer:
    "작년(2024년) 연봉은 2024년도 연봉계약서에 따라 책정되었으며[1], 2025년에는 기본급이 전년 대비 5% 인상되었습니다[2].",
  citations: [
    {
      n: 1,
      chunkId: "c-d2-4",
      documentId: "d2",
      documentName: "2024_연봉계약서.pdf",
      snippet: "2024년 연봉 총액 및 지급 일정은 다음과 같다…",
    },
    {
      n: 2,
      chunkId: "c-d1-2",
      documentId: "d1",
      documentName: "2025_연봉계약서.pdf",
      snippet: "2025년 기본급은 전년 대비 5% 인상되며…",
    },
  ] satisfies Citation[],
};
