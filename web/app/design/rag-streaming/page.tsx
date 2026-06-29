"use client";

// [디자인 참고용 페이지] RAG 스트리밍 응답 로딩 시안.
// 정적 더미. 실제 스트리밍 배선은 없고, 상단 세그먼트로 3단계를 미리 본다.
// 단계: 1) 대기(TTFT, 첫 토큰 전) = 형태를 가진 스켈레톤 카드 + 단계 표시
//       2) 스트리밍 중 = 점진 텍스트 + 깜빡이는 커서 + 인용 스켈레톤 + 중지 버튼
//       3) 완료 = 전체 답변([n] 표식) + 인용 카드(근거 청크 펼침, search-grouped 4안)
// 근거 패턴: TTFT 갭은 빈 화면 대신 답변 형태 스켈레톤, 첫 토큰 후 타이핑 커서, 인용은 완료 시 확정.

import * as React from "react";
import {
  Sparkles,
  Square,
  FileText,
  Eye,
  ChevronDown,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MarkdownView } from "@/components/drive/markdown-view";

type Phase = "waiting" | "streaming" | "done";

const QUERY = "소프트웨어 개발업 회사가 넣을 수 있는 정부 공고";

// 대기 단계에서 보여줄 진행 단계(마지막이 활성).
const STEPS = ["질의 분석", "문서 검색", "답변 생성"] as const;

// 예시 답변(마크다운: 굵게·번호 목록·중첩 항목·[n] 인용).
const FULL = `소프트웨어 개발 회사가 참여할 수 있는 정부 공고로는 다음과 같은 것들이 있습니다:

1. **2026년 방산 스타트업 챌린지 수요기업 협업 과제 모집 공고**
   - 소프트웨어 개발 회사가 창업기업으로 참여하여 군 및 방산 분야 수요기업과 협업할 수 있습니다. [1]
2. **2026년 민관협력 오픈이노베이션 지원: 바이오 창업기업 모집공고**
   - 바이오 분야 창업기업으로 소프트웨어 개발 관련 기술도 포함될 수 있습니다. [2]
3. **2026년 소공인 스마트제조지원(스마트공방)사업 추가 모집 공고**
   - 이 공고는 주로 소공인을 대상으로 하지만, 소프트웨어 개발 관련 기술 도입도 가능할 수 있습니다. [3]
4. **2026년도 민관공동기술사업화R&D(구매연계·상생협력) 제3차 시행계획 공고**
   - 이 공고에서는 다양한 지원 내역이 있으며, 소프트웨어 개발 관련 과제가 포함될 수 있습니다. [4]

각 공고마다 지원 대상, 신청 자격, 지원 내용 등이 다르므로, 소프트웨어 개발 회사가 참여 가능한 구체적인 과제를 확인하기 위해서는 각 공고의 세부 내용을 검토하는 것이 필요합니다.`;

// 스트리밍 중간 시점(부분 마크다운: 셋째 항목이 닫히지 않은 상태).
const PARTIAL = FULL.slice(0, FULL.indexOf("3. **") + 40);

type Cite = { n: number; filename: string; title: string; content: string };

const CITES: Cite[] = [
  {
    n: 1,
    filename: "20260602_민관협력_오픈이노베이션_지원_방산_스타트업_챌린지.pdf",
    title: "2026년 방산 스타트업 챌린지 수요기업 협업 과제 모집공고",
    content:
      "방산 분야 신기술 적용 수요가 있는 군 및 수요기업과 창업기업 간 협업 과제를 모집한다. 창업 7년 이내 기업(소프트웨어 개발 포함)이 신청할 수 있으며, 선정 시 과제 수행비와 실증 기회를 제공한다.",
  },
  {
    n: 2,
    filename: "20260611_2026년_민관협력_오픈이노베이션_지원_바이오_창업.pdf",
    title: "2026년 민관협력 오픈이노베이션 지원: 바이오 창업기업 모집공고",
    content:
      "대기업 수요와 연계한 바이오 분야 창업기업을 모집한다. 소프트웨어 개발 역량을 갖춘 기업도 협업 파트너로 참여할 수 있으나, 모집 분야는 바이오에 한정된다.",
  },
  {
    n: 3,
    filename: "20260615_2026년_소공인_스마트제조지원_스마트공방_추가_모집_공고.pdf",
    title: "2026년 소공인 스마트제조지원(스마트공방)사업 추가 모집 공고",
    content:
      "소공인의 제조 공정에 스마트 기술(IoT·자동화·소프트웨어)을 도입하는 비용을 지원한다. 주 대상은 소공인이나 기술 공급 기업과의 협업 형태로 소프트웨어 개발이 포함될 수 있다.",
  },
  {
    n: 4,
    filename: "20260615_2026년도_민관공동기술사업화R&D_제3차_시행계획_공고.pdf",
    title: "2026년도 민관공동기술사업화R&D(구매연계·상생협력) 제3차 시행계획 공고",
    content:
      "구매연계·상생협력형 기술사업화 R&D 과제를 모집한다. 지원 분야가 넓어 소프트웨어 개발 관련 과제도 포함될 수 있으며, 수요기업과의 매칭이 전제된다.",
  },
];

const WaitingCard = () => (
  <div className="rounded-lg border bg-muted/30 p-4" role="status" aria-live="polite">
    <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
      <Sparkles className="size-4 animate-pulse text-primary" />
      {/* 단계 표시 — 빈 화면 대신 무엇을 하는 중인지 알린다 */}
      <span className="flex items-center gap-1.5">
        {STEPS.map((s, i) => (
          <React.Fragment key={s}>
            {i > 0 && <span className="text-muted-foreground/40">›</span>}
            <span
              className={cn(
                i === STEPS.length - 1 ? "font-medium text-foreground" : "text-muted-foreground/60",
              )}
            >
              {s}
            </span>
          </React.Fragment>
        ))}
        <span className="ml-1 inline-flex w-4 animate-pulse">…</span>
      </span>
    </div>
    {/* 답변 형태 스켈레톤 — 폭이 줄어드는 3~4줄로 텍스트 윤곽을 흉내 */}
    <div className="space-y-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-[92%]" />
      <Skeleton className="h-4 w-[84%]" />
      <Skeleton className="h-4 w-[60%]" />
    </div>
  </div>
);

const StreamingCard = () => (
  <div className="rounded-lg border bg-muted/30 p-4" role="status" aria-live="polite">
    <div className="flex items-start gap-2">
      <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
      {/* 스트리밍 중에도 같은 마크다운 뷰어로 부분 마크다운을 렌더, 커서는 마지막 토큰 뒤 인라인 */}
      <div className="min-w-0 flex-1">
        <MarkdownView streaming>{PARTIAL}</MarkdownView>
      </div>
    </div>
  </div>
);

const DoneCard = () => (
  <div className="rounded-lg border bg-muted/30 p-4">
    <div className="flex items-start gap-2">
      <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
      {/* 완료 결과도 동일 마크다운 뷰어 */}
      <div className="min-w-0 flex-1">
        <MarkdownView>{FULL}</MarkdownView>
      </div>
    </div>
  </div>
);

// 인용 카드 — 근거 청크를 접고 펼친다(search-grouped 4안: 화살표 토글, 첫 항목 펼침).
const CitationCard = ({ cite, defaultOpen }: { cite: Cite; defaultOpen: boolean }) => {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="rounded-lg border">
      <div className="flex items-start gap-2 p-3">
        <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded bg-primary/15 text-xs font-medium text-primary">
          {cite.n}
        </span>
        <div className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1 text-sm font-medium">
            <FileText className="size-3.5 shrink-0" />
            <span className="truncate">{cite.filename}</span>
          </span>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{cite.title}</p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={open ? "근거 접기" : "근거 보기"}
            onClick={() => setOpen((o) => !o)}
          >
            <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
          </Button>
          <Button variant="ghost" size="icon" className="size-7" aria-label="상세 보기">
            <Eye className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-7" aria-label="문서 작업">
            <MoreHorizontal className="size-4" />
          </Button>
        </div>
      </div>
      {/* 근거 청크 본문 — 왜 이 문서를 인용했는지 */}
      {open && (
        <div className="border-t bg-muted/30 px-3 py-2.5">
          <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {cite.content}
          </p>
        </div>
      )}
    </div>
  );
};

const CitationSkeletons = () => (
  <div className="space-y-2">
    <p className="text-[11px] text-muted-foreground">인용 출처 수집 중…</p>
    {[0, 1].map((i) => (
      <div key={i} className="flex items-start gap-2 rounded-lg border p-3">
        <Skeleton className="size-5 shrink-0 rounded" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-4 w-[70%]" />
          <Skeleton className="h-3 w-[45%]" />
        </div>
      </div>
    ))}
  </div>
);

const RagStreamingDesignPage = () => {
  const [phase, setPhase] = React.useState<Phase>("waiting");
  const streaming = phase !== "done";

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      {/* 단계 미리보기 토글(시안 전용) */}
      <div className="inline-flex rounded-md border p-0.5 text-sm">
        {(["waiting", "streaming", "done"] as Phase[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPhase(p)}
            className={cn(
              "rounded px-3 py-1",
              phase === p ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {p === "waiting" ? "대기(TTFT)" : p === "streaming" ? "스트리밍 중" : "완료"}
          </button>
        ))}
      </div>

      <div>
        <h1 className="text-lg font-semibold">RAG 검색 결과</h1>
        <p className="truncate text-sm text-muted-foreground">“{QUERY}”</p>
        <p className="pt-1 text-[11px] text-muted-foreground tabular-nums">
          {phase === "done" ? "응답 21.1초 · 인용 2개" : phase === "streaming" ? "생성 중…" : "검색 중…"}
        </p>
      </div>

      {/* 답변 영역 */}
      {phase === "waiting" && <WaitingCard />}
      {phase === "streaming" && <StreamingCard />}
      {phase === "done" && <DoneCard />}

      {/* 생성 중에는 중지 버튼 노출(중간에 끊을 수 있게) */}
      {streaming && (
        <Button variant="outline" size="sm" className="gap-1.5">
          <Square className="size-3.5" /> 중지
        </Button>
      )}

      {/* 인용: 완료 시 확정 카드, 스트리밍 중엔 스켈레톤, 대기엔 숨김 */}
      {phase === "done" && (
        <div className="space-y-2">
          <p className="text-sm font-medium">인용 출처</p>
          {CITES.map((c, i) => (
            <CitationCard key={c.n} cite={c} defaultOpen={i === 0} />
          ))}
        </div>
      )}
      {phase === "streaming" && <CitationSkeletons />}
    </div>
  );
};

export default RagStreamingDesignPage;
