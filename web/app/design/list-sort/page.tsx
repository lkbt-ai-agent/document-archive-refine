"use client";

// [디자인 참고용 페이지] 파일/폴더 목록 정렬 필터 비주얼 시안.
// 정적 더미 데이터. 실제 구현은 문서=서버 keyset 정렬(GET /documents?sort=), 폴더=클라 정렬이며
// 여기 정렬은 시안 표시용 클라 정렬일 뿐 실 로직 배선은 없다.
// 정렬 4종: 최신순/오래된순/파일명 오름차순(기본)/파일명 내림차순. 그룹은 "폴더 먼저, 문서 다음".

import * as React from "react";
import {
  FileText,
  Folder as FolderIcon,
  ArrowDownUp,
  Eye,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Sort = "newest" | "oldest" | "name_asc" | "name_desc";

const SORT_LABEL: Record<Sort, string> = {
  name_asc: "이름 오름차순",
  name_desc: "이름 내림차순",
  newest: "최신순",
  oldest: "오래된순",
};

// 드롭다운 노출 순서(기본 name_asc를 맨 위에).
const SORT_ORDER: Sort[] = ["name_asc", "name_desc", "newest", "oldest"];

type DummyFolder = { id: string; name: string; createdAt: string };
type DummyDoc = {
  id: string;
  name: string;
  createdAt: string;
  sizeBytes: number;
  status: "ready" | "processing" | "failed";
};

const FOLDERS: DummyFolder[] = [
  { id: "f1", name: "공모전", createdAt: "2026-03-02" },
  { id: "f2", name: "보도자료", createdAt: "2026-05-21" },
  { id: "f3", name: "내부 검토", createdAt: "2026-01-14" },
];

const DOCS: DummyDoc[] = [
  { id: "d1", name: "2026년_소공인_판로개척지원사업_공고.pdf", createdAt: "2026-06-15", sizeBytes: 824_000, status: "ready" },
  { id: "d2", name: "2026년_창업도시_조성_프로젝트_모집공고.pdf", createdAt: "2026-06-22", sizeBytes: 1_530_000, status: "ready" },
  { id: "d3", name: "★디지털기반_중소사업장_산재예방_공고.pdf", createdAt: "2026-06-15", sizeBytes: 2_140_000, status: "processing" },
  { id: "d4", name: "민관협력_오픈이노베이션_창업기업_모집공고.pdf", createdAt: "2026-06-16", sizeBytes: 998_000, status: "ready" },
  { id: "d5", name: "표준근로계약서.pdf", createdAt: "2026-02-09", sizeBytes: 64_000, status: "failed" },
];

const fmtBytes = (n: number) => `${(n / 1_000_000).toFixed(1)} MB`;

// 시안 표시용 정렬(실제 정렬 로직 아님). 폴더와 문서를 각각 같은 기준으로 정렬한다.
const cmp = <T extends { name: string; createdAt: string }>(a: T, b: T, sort: Sort) => {
  if (sort === "name_asc") return a.name.localeCompare(b.name, "ko");
  if (sort === "name_desc") return b.name.localeCompare(a.name, "ko");
  if (sort === "oldest") return a.createdAt.localeCompare(b.createdAt);
  return b.createdAt.localeCompare(a.createdAt); // newest
};

const STATUS_BADGE: Record<DummyDoc["status"], { label: string; cls: string }> = {
  ready: { label: "완료", cls: "border-transparent bg-emerald-500/15 text-emerald-600" },
  processing: { label: "처리 중", cls: "border-transparent bg-amber-500/15 text-amber-600" },
  failed: { label: "실패", cls: "border-transparent bg-red-500/15 text-red-600" },
};

const ListSortDesignPage = () => {
  const [sort, setSort] = React.useState<Sort>("name_asc");

  const folders = React.useMemo(
    () => [...FOLDERS].sort((a, b) => cmp(a, b, sort)),
    [sort],
  );
  const docs = React.useMemo(() => [...DOCS].sort((a, b) => cmp(a, b, sort)), [sort]);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-4">
        <h1 className="text-lg font-semibold">목록 정렬 필터 시안</h1>
        <p className="text-sm text-muted-foreground">
          헤더 우측 정렬 드롭다운 + 폴더 먼저/문서 다음 그룹. 정렬은 시안 표시용 더미입니다.
        </p>
      </div>

      <div className="rounded-lg border">
        {/* 목록 헤더: 폴더명 + N개 문서 + 정렬 드롭다운 */}
        <div className="flex items-center justify-between px-4 py-2.5">
          <h2 className="truncate text-sm font-semibold">정부공고</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{docs.length}개 문서</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5">
                  <ArrowDownUp className="size-3.5" />
                  {SORT_LABEL[sort]}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup
                  value={sort}
                  onValueChange={(v) => setSort(v as Sort)}
                >
                  {SORT_ORDER.map((s) => (
                    <DropdownMenuRadioItem key={s} value={s}>
                      {SORT_LABEL[s]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="px-2 pb-2 sm:px-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이름</TableHead>
                <TableHead className="hidden sm:table-cell">상태</TableHead>
                <TableHead className="hidden md:table-cell">크기</TableHead>
                <TableHead className="hidden lg:table-cell">등록일</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* 폴더 먼저 */}
              {folders.map((f) => (
                <TableRow key={f.id} className="cursor-pointer select-none">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FolderIcon className="size-4 shrink-0 text-primary" />
                      <span className="truncate font-medium">{f.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">—</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">—</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground tabular-nums">
                    {f.createdAt}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-0.5">
                      <Button variant="ghost" size="icon" className="size-7">
                        <Eye className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {/* 문서 다음 */}
              {docs.map((d) => {
                const b = STATUS_BADGE[d.status];
                return (
                  <TableRow key={d.id} className="cursor-pointer select-none">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{d.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge className={b.cls}>{b.label}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground tabular-nums">
                      {fmtBytes(d.sizeBytes)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground tabular-nums">
                      {d.createdAt}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-0.5">
                        <Button variant="ghost" size="icon" className="size-7">
                          <Eye className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-7">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default ListSortDesignPage;
