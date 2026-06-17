import { redirect } from "next/navigation";

// "/" → 내 아카이브로 이동
const RootPage = () => {
  redirect("/my-archive");
};

export default RootPage;
