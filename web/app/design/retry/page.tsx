"use client";

// [디자인 참고용 페이지] 인제스트 실패 문서의 "재시도" UI 비주얼 시안.
// 정적 더미 데이터. 실 API 배선은 없고, 버튼 클릭은 로컬 state로 "처리 중" 전환만 흉내낸다.
// 실패 종류에 따라 액션이 갈린다: 일시 오류=재시도, 영구 오류=재시도 불가, 객체 없음=재업로드, 상한 초과=재시도 불가.

import * as React from "react";
import {
  AlertTriangle,
  Ban,
  FileText,
  Loader2,
  RotateCcw,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// 실패 분류. 백엔드 응답(코드)과 대응한다.
// transient=재시도 가능, permanent=영구 오류, reupload=객체 없음, limit=상한 초과.
type FailKind = "transient" | "permanent" | "reupload" | "limit";

type Doc = {
  id: string;
  name: string;
  error: string;
  kind: FailKind;
  retryCount: number;
};

const DOCS: Doc[] = [
  {
    id: "d1",
    name: "20260529_다자녀 매입임대주택 입주자 모집공고.pdf",
    error: "인제스트가 취소 또는 타임아웃으로 중단됨",
    kind: "transient",
    retryCount: 1,
  },
  {
    id: "d2",
    name: "20260617_유니버설디자인하우스 창동 모집공고.pdf",
    error: "ConnectTimeout",
    kind: "transient",
    retryCount: 0,
  },
  {
    id: "d3",
    name: "회의록_초안.hwpx",
    error: "지원하지 않는 파일 형식: unknown",
    kind: "permanent",
    retryCount: 0,
  },
  {
    id: "d4",
    name: "스캔본_누락.pdf",
    error: "업로드가 확인되지 않았습니다(오브젝트 없음).",
    kind: "reupload",
    retryCount: 0,
  },
  {
    id: "d5",
    name: "대용량_공고문.pdf",
    error: "인제스트가 취소 또는 타임아웃으로 중단됨",
    kind: "limit",
    retryCount: 5,
  },
];

const KIND_HINT: Record<FailKind, string> = {
  transient: "일시 오류입니다. 다시 시도하면 복구될 수 있습니다.",
  permanent: "재시도로 복구할 수 없는 오류입니다.",
  reupload: "원본 파일이 없어 다시 처리할 수 없습니다. 재업로드가 필요합니다.",
  limit: "재시도 횟수 상한(5회)을 초과했습니다.",
};

const RetryRow = ({ doc }: { doc: Doc }) => {
  // 로컬 시뮬레이션: 재시도 클릭 시 "처리 중"으로 전환(실 API 없음).
  const [retrying, setRetrying] = React.useState(false);

  const onRetry = () => {
    setRetrying(true);
    setTimeout(() => setRetrying(false), 2000); // 시안용: 잠시 후 원복
  };

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-start gap-2">
        <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{doc.name}</p>
          {/* 상태 배지 */}
          <div className="mt-1 flex items-center gap-1.5">
            {retrying ? (
              <Badge variant="outline" className="gap-1 text-status-processing">
                <Loader2 className="size-3 animate-spin" /> 처리 중
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-status-failed">
                <AlertTriangle className="size-3" /> 실패
              </Badge>
            )}
            {doc.retryCount > 0 && (
              <span className="text-[11px] text-muted-foreground tabular-nums">
                재시도 {doc.retryCount}/5
              </span>
            )}
          </div>
          {/* 실패 사유 + 분류 안내 */}
          {!retrying && (
            <div className="mt-1.5 rounded-md border border-status-failed/30 bg-status-failed/10 p-2 text-xs text-status-failed">
              <p className="break-words">{doc.error}</p>
              <p className="mt-1 text-muted-foreground">{KIND_HINT[doc.kind]}</p>
            </div>
          )}
        </div>
        {/* 분류별 액션 */}
        <div className="flex shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
          {doc.kind === "transient" && (
            <Button size="sm" variant="outline" disabled={retrying} onClick={onRetry}>
              <RotateCcw className={cn("size-4", retrying && "animate-spin")} /> 재시도
            </Button>
          )}
          {doc.kind === "reupload" && (
            <Button size="sm" variant="outline">
              <Upload className="size-4" /> 재업로드
            </Button>
          )}
          {(doc.kind === "permanent" || doc.kind === "limit") && (
            <Button size="sm" variant="outline" disabled>
              <Ban className="size-4" /> 재시도 불가
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

const RetryDesignPage = () => {
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <div>
        <h1 className="text-lg font-semibold">재시도 UI 시안</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          인제스트 실패 문서의 재시도 화면 디자인 프로토타입입니다. 정적 더미이며 실제
          기능은 개발자 컨펌 후 배선합니다.
        </p>
      </div>
      <div className="space-y-2">
        {DOCS.map((d) => (
          <RetryRow key={d.id} doc={d} />
        ))}
      </div>
      <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">분류 규칙</p>
        <ul className="mt-1 space-y-0.5">
          <li>일시 오류(타임아웃, 연결 실패): 재시도 버튼.</li>
          <li>영구 오류(미지원 형식): 재시도 불가(버튼 비활성).</li>
          <li>객체 없음: 재업로드 버튼.</li>
          <li>상한 초과(5회): 재시도 불가.</li>
        </ul>
      </div>
    </div>
  );
};

export default RetryDesignPage;
