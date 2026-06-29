"use client";

// RAG 답변 공용 마크다운 뷰어 — 스트리밍 중(부분 마크다운)과 완료 결과가 같은 뷰어를 쓴다.
// react-markdown은 닫히지 않은 굵게/목록/표 같은 부분 마크다운도 무난히 렌더해 스트리밍에 적합하다.
// 원본 보기(original-viewer-dialog)와 같은 prose 스타일을 공유한다.

import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

// 스트리밍 커서를 마지막 토큰 바로 뒤(인라인)에 두려고, 텍스트 끝에 이 링크 마커를 붙여
// 마지막 인라인 위치에 렌더한 뒤 a 렌더에서 깜빡이는 커서로 바꾼다(블록 밖 형제로 두면 새 줄로 떨어진다).
const CARET_HREF = "#__caret__";

// a 렌더 오버라이드: #__caret__ 은 깜빡이는 커서, #cite-n 은 클릭 인용 배지, 그 외는 일반 링크.
// 인용 표식은 `[n]`을 `[n](#cite-n)` 링크로 전처리해 넘긴다(linkifyCitations).
const buildComponents = (
  onCitationClick?: (n: number) => void,
): Components => ({
  a({ href, children }) {
    if (href === CARET_HREF) {
      return (
        <span
          aria-hidden
          className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-foreground align-middle"
        />
      );
    }
    const m = /^#cite-(\d+)$/.exec(href ?? "");
    if (m && onCitationClick) {
      const n = Number(m[1]);
      return (
        <button
          type="button"
          onClick={() => onCitationClick(n)}
          className="mx-0.5 inline-flex items-center rounded bg-primary/15 px-1 align-middle text-xs font-medium text-primary hover:bg-primary/25"
        >
          [{children}]
        </button>
      );
    }
    return (
      <a href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  },
});

export const MarkdownView = ({
  children,
  className,
  onCitationClick,
  streaming,
}: {
  children: string;
  className?: string;
  onCitationClick?: (n: number) => void;
  streaming?: boolean;
}) => (
  <div
    className={cn(
      "text-sm leading-relaxed break-words",
      "[&_h1]:mt-3 [&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-semibold",
      "[&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:font-semibold",
      "[&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:font-semibold",
      "[&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
      "[&_li]:my-0.5 [&_strong]:font-semibold",
      "[&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
      "[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse",
      "[&_th]:border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_td]:border [&_td]:px-2 [&_td]:py-1",
      "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs",
      "[&_a]:text-primary [&_a]:underline",
      className,
    )}
  >
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={onCitationClick || streaming ? buildComponents(onCitationClick) : undefined}
    >
      {streaming ? `${children}[c](${CARET_HREF})` : children}
    </Markdown>
  </div>
);
