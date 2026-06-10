import { DriveApp } from "@/components/drive/drive-app";

// AppShell (RSC) — arch 10 §4/§5. 초기 셸은 서버 컴포넌트, 패널은 클라이언트.
// Phase 4 에서 HydrationBoundary 로 초기 데이터 시드(4.2).
export default function Home() {
  return <DriveApp />;
}
