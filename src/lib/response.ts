import type { ApiResponse } from "./types";

/** Build a standard API response */
export function apiResponse<T>(
  data: T,
  source: string,
  opts: { isStale?: boolean; fallbackUsed?: boolean; fetchedAt?: string } = {},
): Response {
  const body: ApiResponse<T> = {
    data,
    source,
    fetchedAt: opts.fetchedAt ?? new Date().toISOString(),
    isStale: opts.isStale ?? false,
    fallbackUsed: opts.fallbackUsed ?? false,
  };
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export function errorResponse(message: string, status = 500): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
