import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getCached, setCache, getCachedSWR, setCacheSWR } from "@/lib/cache";
import { apiResponse, errorResponse } from "@/lib/response";
import { CACHE_TTL } from "@/lib/types";
import {
  fetchCurrentConditions,
  fetchTodayObservations,
  normalizeCurrentConditions,
} from "@/lib/providers/wunderground";
import { fetchCurrentSupplement } from "@/lib/providers/open-meteo";

const FRESH_TTL = CACHE_TTL.current; // 5 min — consider data fresh
const STALE_TTL = 3600; // 1 hour — keep serving stale data while revalidating

export const GET: APIRoute = async () => {
  const cacheKey = "current";
  const kv = env.WEATHER_CACHE;

  // Try SWR cache — returns data even if stale
  try {
    const cached = await getCachedSWR<ReturnType<typeof normalizeCurrentConditions>>(
      kv,
      cacheKey,
      FRESH_TTL,
    );

    if (cached) {
      if (cached.stale) {
        // Return stale data immediately, refresh in background
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        refreshInBackground(kv, cacheKey);
        return apiResponse(cached.data, "weather-underground", {
          fetchedAt: cached.fetchedAt,
          isStale: true,
        });
      }
      return apiResponse(cached.data, "weather-underground", {
        fetchedAt: cached.fetchedAt,
        isStale: false,
      });
    }
  } catch {
    // Cache miss or error, proceed to fetch
  }

  // No cache at all — fetch fresh
  try {
    const data = await fetchFresh();
    await setCacheSWR(kv, cacheKey, data, STALE_TTL);
    return apiResponse(data, "weather-underground");
  } catch (err) {
    // Last resort: try old-style backup cache
    try {
      const stale = await getCached(kv, `${cacheKey}:backup`);
      if (stale) {
        return apiResponse(stale.data, "weather-underground", {
          fetchedAt: stale.fetchedAt,
          isStale: true,
        });
      }
    } catch {
      // No stale data available
    }

    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(`Failed to fetch current conditions: ${message}`);
  }
};

async function fetchFresh() {
  const [rawCurrent, rawHistory, supplement] = await Promise.all([
    fetchCurrentConditions(env.WU_API_KEY, env.STATION_ID),
    fetchTodayObservations(env.WU_API_KEY, env.STATION_ID).catch(() => null),
    fetchCurrentSupplement().catch(() => null),
  ]);
  return normalizeCurrentConditions(rawCurrent, rawHistory ?? undefined, supplement ?? undefined);
}

async function refreshInBackground(kv: KVNamespace, cacheKey: string) {
  try {
    const data = await fetchFresh();
    await setCacheSWR(kv, cacheKey, data, STALE_TTL);
  } catch {
    // Background refresh failed — stale data still being served
  }
}
