"use client";

// [디자인 참고용 페이지] 검색 결과 "문서 그룹 + 청크" 비주얼 시안 (plan D19).
// 정적 더미 데이터. 실 화면은 SearchResults(3안=더보기 토글)로 구현됨 — 여기는 1·2·3안 비교 보존용.
// 안: 1=캐러셀 / 2=토글(아코디언) / 3=더보기 토글. 공통: 키워드=하이라이트, 의미=컨셉 해시태그.

import * as React from "react";
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Eye,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Mode = "keyword" | "semantic";
type Chunk = {
  chunkId: string;
  score: number;
  content: string;
  concepts: string[];
};
type Group = {
  documentId: string;
  title: string;
  filename: string;
  chunks: Chunk[];
};

const QUERY = "잔여";

const GROUPS: Group[] = [
  {
    documentId: "6db1d02e-c859-49f3-852b-98cc6df8be52",
    title: "홍은동 청년협동조합 주택 잔여세대 입주자 모집공고",
    filename: "20260605_홍은동_청년협동조합_잔여세대_입주자모집.pdf",
    chunks: [
      {
        chunkId: "6db1d02e-c859-49f3-852b-98cc6df8be52",
        score: 0.374,
        content:
          "• 주식, 수익증권, 출자금, 출자지분, 부동산(연금)신탁 : 최종 시세가액. 이 경우 비상장주식 금융 의 평가에 관하여는 「상속세 및 증여세법 시행령」 제54조 제1항을 준용한다.\n• 연금저축 : 정기적으로 지급된 금액 또는 최종 잔여 금액",
        concepts: ["자산평가", "출자금", "연금저축"],
      },
      {
        chunkId: "a1c2e3f4-1111-2222-3333-444455556666",
        score: 0.361,
        content:
          "잔여세대 입주자 모집 일정 : 신청 접수 2026.06.10 ~ 06.14, 서류심사 발표 06.20, 계약 체결 06.25 ~ 06.27. 가동·나동 단지 (홍은동 345-3 및 345-5, 해담하우스).",
        concepts: ["모집일정", "계약체결", "단지정보"],
      },
      {
        chunkId: "b2d3f4a5-7777-8888-9999-000011112222",
        score: 0.352,
        content:
          "청렴 청신호, 부패 적신호 — 홍은동 청년협동조합[이웃기금] 운영 원칙. 입주자는 조합 정관 및 운영규정을 준수하여야 한다.",
        concepts: ["운영원칙", "정관준수"],
      },
    ],
  },
  {
    documentId: "f4ba56fc-bfb1-426b-833c-5876ca8a92d5",
    title: "표준근로계약서 및 관련 규정",
    filename: "표준근로계약서.pdf",
    chunks: [
      {
        chunkId: "c3e4f5a6-aaaa-bbbb-cccc-ddddeeeeffff",
        score: 0.349,
        content:
          "근로계약서는 기간의 정함이 있는 경우와 없는 경우로 구분하며, 근로조건·임금·연차유급휴가·사회보험 적용 여부 등을 명시하여야 한다.",
        concepts: ["근로조건", "임금", "연차유급휴가", "사회보험"],
      },
      {
        chunkId: "d4f5a6b7-1010-2020-3030-404050506060",
        score: 0.341,
        content:
          "연소근로자·건설일용근로자·단시간근로자 등 근로 형태별 표준 양식을 포함하며, 각 계약서는 근로기준법에 따라 작성되어야 한다.",
        concepts: ["근로형태", "근로기준법"],
      },
    ],
  },
  {
    documentId: "9a8b7c6d-5e4f-3a2b-1c0d-aabbccddeeff",
    title: "양산시 행복주택 입주자격 완화 예비입주자 모집공고",
    filename: "(2026.6.15)양산시행복주택입주자격완화예비입주자모집공고문.pdf",
    chunks: [
      {
        chunkId: "11112222-3333-4444-5555-666677778888",
        score: 0.358,
        content:
          "예비입주자 잔여 물량에 대해 입주자격을 완화하여 추가 모집한다. 무주택세대구성원 요건은 유지한다.",
        concepts: ["예비입주자", "자격완화", "무주택요건"],
      },
      {
        chunkId: "22223333-4444-5555-6666-777788889999",
        score: 0.347,
        content:
          "소득·자산 기준 : 전년도 도시근로자 가구원수별 월평균 소득의 100% 이하, 총자산 및 자동차가액 기준을 충족하여야 한다.",
        concepts: ["소득기준", "자산기준"],
      },
      {
        chunkId: "33334444-5555-6666-7777-88889999aaaa",
        score: 0.339,
        content:
          "신청 방법 : 인터넷 청약 또는 현장 접수. 잔여 세대 발생 시 예비입주자 순번에 따라 추가 계약을 진행한다.",
        concepts: ["신청방법", "예비순번"],
      },
    ],
  },
];

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const Highlighted = ({ text, query }: { text: string; query: string }) => {
  if (!query) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, "gi"));
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={i}
            className="rounded bg-yellow-200 px-0.5 text-foreground dark:bg-yellow-500/40"
          >
            {p}
          </mark>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </>
  );
};

const ChunkBody = ({ chunk, mode }: { chunk: Chunk; mode: Mode }) => (
  <div className="space-y-2">
    <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
      {mode === "keyword" ? (
        <Highlighted text={chunk.content} query={QUERY} />
      ) : (
        chunk.content
      )}
    </p>
    {mode === "semantic" && chunk.concepts.length > 0 && (
      <div className="flex flex-wrap gap-1">
        {chunk.concepts.map((c) => (
          <span
            key={c}
            className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
          >
            #{c}
          </span>
        ))}
      </div>
    )}
  </div>
);

const ChunkMeta = ({ chunk }: { chunk: Chunk }) => (
  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
    <span className="min-w-0 flex-1 truncate font-mono">{chunk.chunkId}</span>
    <span className="shrink-0 tabular-nums">score {chunk.score.toFixed(4)}</span>
  </div>
);

// 1안: 캐러셀
const ChunkCarousel = ({ chunks, mode }: { chunks: Chunk[]; mode: Mode }) => {
  const [i, setI] = React.useState(0);
  const n = chunks.length;
  const go = (d: number) => setI((p) => Math.min(n - 1, Math.max(0, p + d)));
  const touchX = React.useRef<number | null>(null);

  return (
    <div className="space-y-2">
      <div className="relative">
        <div
          className="overflow-hidden rounded-md border bg-muted/30"
          onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX.current == null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            if (dx < -40) go(1);
            else if (dx > 40) go(-1);
            touchX.current = null;
          }}
        >
          <div
            className="flex transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${i * 100}%)` }}
          >
            {chunks.map((c) => (
              <div key={c.chunkId} className="min-w-full space-y-2 p-3.5">
                <ChunkMeta chunk={c} />
                <ChunkBody chunk={c} mode={mode} />
              </div>
            ))}
          </div>
        </div>

        {n > 1 && (
          <>
            <Button
              variant="secondary"
              size="icon"
              aria-label="이전 청크"
              disabled={i === 0}
              onClick={() => go(-1)}
              className="absolute top-1/2 left-1 size-7 -translate-y-1/2 rounded-full opacity-90 shadow-sm"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              aria-label="다음 청크"
              disabled={i === n - 1}
              onClick={() => go(1)}
              className="absolute top-1/2 right-1 size-7 -translate-y-1/2 rounded-full opacity-90 shadow-sm"
            >
              <ChevronRight className="size-4" />
            </Button>
          </>
        )}
      </div>

      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {i + 1} / {n}
        </span>
        <div className="flex gap-1">
          {chunks.map((c, k) => (
            <button
              key={c.chunkId}
              aria-label={`청크 ${k + 1}`}
              onClick={() => setI(k)}
              className={cn(
                "size-1.5 rounded-full transition-colors",
                k === i ? "bg-primary" : "bg-muted-foreground/30",
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// 2안: 토글(아코디언)
const ChunkToggleList = ({ chunks, mode }: { chunks: Chunk[]; mode: Mode }) => {
  const [open, setOpen] = React.useState<Set<string>>(
    () => new Set([chunks[0].chunkId]),
  );
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="divide-y overflow-hidden rounded-md border">
      {chunks.map((c, k) => {
        const isOpen = open.has(c.chunkId);
        return (
          <div key={c.chunkId}>
            <button
              onClick={() => toggle(c.chunkId)}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent/40"
            >
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform",
                  isOpen && "rotate-180",
                )}
              />
              <span className="shrink-0 text-xs text-muted-foreground">
                청크 {k + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {c.content}
              </span>
              <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                {c.score.toFixed(2)}
              </span>
            </button>
            {isOpen && (
              <div className="space-y-2 bg-muted/30 px-3 pt-1 pb-3">
                <ChunkMeta chunk={c} />
                <ChunkBody chunk={c} mode={mode} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// 3안: 더보기 토글 (실 적용된 안)
const ChunkMore = ({ chunks, mode }: { chunks: Chunk[]; mode: Mode }) => {
  const [open, setOpen] = React.useState(false);
  const rest = chunks.length - 1;
  const visible = open ? chunks : chunks.slice(0, 1);

  return (
    <div className="space-y-2">
      {visible.map((c) => (
        <div
          key={c.chunkId}
          className="space-y-2 rounded-md border bg-muted/30 p-3.5"
        >
          <ChunkMeta chunk={c} />
          <ChunkBody chunk={c} mode={mode} />
        </div>
      ))}
      {rest > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "접기" : `더보기 ${rest}개`}
          <ChevronDown
            className={cn("size-4 transition-transform", open && "rotate-180")}
          />
        </Button>
      )}
    </div>
  );
};

const VARIANTS = ["1안 캐러셀", "2안 토글", "3안 더보기(실 적용)"];

const DesignSearchGroupedPage = () => {
  const [mode, setMode] = React.useState<Mode>("keyword");

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
      <header className="space-y-2">
        <h1 className="text-lg font-semibold">검색 결과 (디자인 시안)</h1>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-md border p-0.5 text-xs">
            {(["keyword", "semantic"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "rounded px-2.5 py-1 transition-colors",
                  mode === m
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m === "keyword" ? "키워드" : "의미"}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {mode === "keyword"
              ? `키워드 · "${QUERY}" 일치 하이라이트`
              : "의미 · 일치 컨셉 해시태그"}{" "}
            · 1·2·3안 비교(보존용)
          </p>
        </div>
      </header>

      {GROUPS.map((g, idx) => (
        <Card key={g.documentId} className="gap-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="size-4 shrink-0 text-primary" />
              <span className="truncate">{g.title}</span>
            </CardTitle>
            <CardDescription className="truncate">
              {g.filename} · {VARIANTS[idx]}
            </CardDescription>
            <CardAction className="flex items-center gap-1.5">
              <Badge variant="secondary" className="tabular-nums">
                {g.chunks[0].score.toFixed(2)}
              </Badge>
              <Badge variant="outline">청크 {g.chunks.length}</Badge>
              <Button variant="ghost" size="icon" aria-label="인스펙터 열기">
                <Eye className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="작업">
                <MoreHorizontal className="size-4" />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {idx === 0 ? (
              <ChunkCarousel chunks={g.chunks} mode={mode} />
            ) : idx === 1 ? (
              <ChunkToggleList chunks={g.chunks} mode={mode} />
            ) : (
              <ChunkMore chunks={g.chunks} mode={mode} />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default DesignSearchGroupedPage;
