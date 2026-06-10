import { DriveApp } from "@/components/drive/drive-app";

// AppShell (RSC) — arch 10 §4/§5. 초기 셸은 서버 컴포넌트, 패널은 클라이언트.
// 추후 HydrationBoundary 로 초기 데이터 시드 예정.
const Home = () => <DriveApp />;

export default Home;
