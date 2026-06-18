// 백엔드 API 주소 — NEXT_PUBLIC_API_URL 주입(frontend.md §1·§3). 미주입 시 로컬 기본값.
export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
).replace(/\/$/, "");
