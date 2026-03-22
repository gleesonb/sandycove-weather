import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { CACHE_TTL } from "@/lib/types";

interface SourceStatus {
  cached: boolean;
  fetchedAt: string | null;
  ttlSeconds: number;
  isStale: boolean;
}

async function checkCacheEntry(
  kv: KVNamespace,
  key: string,
  ttl: number,
): Promise<SourceStatus> {
  try {
    const raw = await kv.get(key);
    if (!raw) {
      return { cached: false, fetchedAt: null, ttlSeconds: ttl, isStale: true };
    }
    const parsed = JSON.parse(raw);
    const fetchedAt: string = parsed.fetchedAt ?? null;
    const age = fetchedAt
      ? (Date.now() - new Date(fetchedAt).getTime()) / 1000
      : Infinity;
    return {
      cached: true,
      fetchedAt,
      ttlSeconds: ttl,
      isStale: age > ttl,
    };
  } catch {
    return { cached: false, fetchedAt: null, ttlSeconds: ttl, isStale: true };
  }
}

export const GET: APIRoute = async () => {
  const [current, today, forecast, warnings] = await Promise.all([
    checkCacheEntry(env.WEATHER_CACHE, "current", CACHE_TTL.current),
    checkCacheEntry(env.WEATHER_CACHE, "today", CACHE_TTL.today),
    checkCacheEntry(env.WEATHER_CACHE, "forecast", CACHE_TTL.forecast),
    checkCacheEntry(env.WEATHER_CACHE, "warnings", CACHE_TTL.warnings),
  ]);

  const sources = { current, today, forecast, warnings };
  const allFresh = Object.values(sources).every((s) => s.cached && !s.isStale);
  const anyDown = Object.values(sources).every((s) => !s.cached);

  const status = anyDown ? "down" : allFresh ? "ok" : "degraded";

  return new Response(
    JSON.stringify({
      status,
      sources,
      timestamp: new Date().toISOString(),
    }),
    {
      status: status === "down" ? 503 : 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
    },
  );
};
