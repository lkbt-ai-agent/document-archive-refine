import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 원격(Tailscale) dev 서버 접속 허용 — dev 전용 (plan 1.9b)
  // Next.js 16은 localhost 외 origin의 dev 전용 자산(HMR 등) cross-origin 요청을 기본 차단한다.
  allowedDevOrigins: ["xxx-macmini.tail902fcf.ts.net", "*.tail902fcf.ts.net"],
};

export default nextConfig;
