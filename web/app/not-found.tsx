import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ROOT_PATH } from "@/lib/routes";

// 전역 404 (App Router app/not-found.tsx) — shadcn Empty 기반
const NotFound = () => (
  <div className="flex min-h-dvh items-center justify-center p-6">
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileQuestion />
        </EmptyMedia>
        <EmptyTitle>페이지를 찾을 수 없습니다</EmptyTitle>
        <EmptyDescription>
          요청하신 주소가 없거나 이동되었습니다.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild>
          <Link href={ROOT_PATH}>내 아카이브로 이동</Link>
        </Button>
      </EmptyContent>
    </Empty>
  </div>
);

export default NotFound;
