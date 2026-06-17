import { DriveShell } from "@/components/drive/drive-shell";

// 공유 셸 layout — `/my-archive`, `/folders/[folderKey]`, `/search` 전반에서 유지.
const DriveLayout = ({ children }: { children: React.ReactNode }) => (
  <DriveShell>{children}</DriveShell>
);

export default DriveLayout;
