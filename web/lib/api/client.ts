import { API_URL } from "@/lib/config";

// 공통 에러 모델 — 백엔드는 모든 에러를 {"error":{code,message,details}} 로 직렬화(backend.md §7).
export class ApiError extends Error {
  status: number;
  code: string;
  details: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;
type FetchOpts = Omit<RequestInit, "body"> & { body?: unknown; query?: Query };

const buildUrl = (path: string, query?: Query): string => {
  const url = new URL(API_URL + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== null && v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
};

// 백엔드 호출 래퍼 — JSON 직렬화, 에러 봉투 파싱, 204 처리.
export const apiFetch = async <T>(path: string, opts: FetchOpts = {}): Promise<T> => {
  const { body, query, headers, ...rest } = opts;
  const res = await fetch(buildUrl(path, query), {
    ...rest,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string; details?: unknown } })?.error;
    throw new ApiError(
      res.status,
      err?.code ?? "error",
      err?.message ?? res.statusText,
      err?.details,
    );
  }
  return data as T;
};

// 토스트용 사용자 메시지 추출.
export const errorMessage = (e: unknown): string =>
  e instanceof ApiError ? e.message : "요청에 실패했습니다.";
