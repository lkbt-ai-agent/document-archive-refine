import { redirect } from "next/navigation";

// "/folders" (key 없음) → 내 아카이브로 이동
const FoldersIndex = () => {
  redirect("/my-archive");
};

export default FoldersIndex;
