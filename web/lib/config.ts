// 백엔드 API 주소 — NEXT_PUBLIC_API_URL 주입(frontend.md §1·§3). 미주입 시 로컬 기본값.
const RAW = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

// 서버(SSR)는 env 그대로(127.0.0.1/localhost). 클라이언트는 env가 localhost인 경우
// "페이지를 연 호스트명:API포트"로 호출 → localhost·Tailscale 등 어느 호스트로 접속해도 동작.
// 운영처럼 env에 외부 도메인을 명시하면 그 값을 그대로 존중한다.
const resolveApiUrl = (): string => {
  if (typeof window === "undefined") return RAW;
  try {
    const env = new URL(RAW);
    if (env.hostname === "localhost" || env.hostname === "127.0.0.1") {
      const port = env.port || "8000";
      return `${window.location.protocol}//${window.location.hostname}:${port}`;
    }
  } catch {
    /* RAW 파싱 실패 시 그대로 사용 */
  }
  return RAW;
};

export const API_URL = resolveApiUrl();
