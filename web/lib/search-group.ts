import type { SearchResultItem } from "@/lib/types";

// 검색 결과(청크 평면)를 문서 단위로 묶는다 (search-frontend §3a, plan D19).
// 같은 문서의 여러 매칭 청크를 한 그룹으로 모아 문서당 1 카드로 렌더한다.
export interface SearchGroupChunk {
  chunkId: string;
  score: number;
  snippet: string;
}

export interface SearchGroup {
  documentId: string;
  documentName: string; // 현재 파일명(카드 큰 제목)
  llmTitle?: string; // ai 보정 제목(카드 작은 제목)
  folderId: string;
  keywords: string[]; // 문서 keywords — 결과 카드 해시태그
  topScore: number; // 그룹 정렬·헤더 표시용 최고 score
  chunks: SearchGroupChunk[]; // score desc
}

// documentId로 그룹화. 그룹은 최고 score desc, 그룹 내 청크는 score desc.
export const groupResults = (results: SearchResultItem[]): SearchGroup[] => {
  const map = new Map<string, SearchGroup>();
  for (const r of results) {
    let g = map.get(r.documentId);
    if (!g) {
      g = {
        documentId: r.documentId,
        documentName: r.documentName,
        llmTitle: r.llmTitle,
        folderId: r.folderId,
        keywords: r.keywords,
        topScore: r.score,
        chunks: [],
      };
      map.set(r.documentId, g);
    }
    g.chunks.push({ chunkId: r.chunkId, score: r.score, snippet: r.snippet });
    if (r.score > g.topScore) g.topScore = r.score;
  }
  const groups = [...map.values()];
  for (const g of groups) g.chunks.sort((a, b) => b.score - a.score);
  groups.sort((a, b) => b.topScore - a.topScore);
  return groups;
};
