import { SearchResults } from "@/components/drive/search-results";
import type { SearchMode } from "@/lib/types";

// "/search?q=&mode=" → 검색 결과 화면(키워드/의미/rag)
const SearchPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; mode?: string }>;
}) => {
  const { q, mode } = await searchParams;
  return (
    <SearchResults q={q ?? ""} mode={(mode as SearchMode) ?? "semantic"} />
  );
};

export default SearchPage;
