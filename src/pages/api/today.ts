import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getCached, setCache } from "@/lib/cache";
import { apiResponse, errorResponse } from "@/lib/response";
import { CACHE_TTL } from "@/lib/types";
import {
  fetchTodayObservations,
  normalizeObservations,
} from "@/lib/providers/wunderground";

export const GET: APIRoute = async () => {
  const cacheKey = "today";

  try {
    const cached = await getCached(env.WEATHER_CACHE, cacheKey);
    if (cached) {
      return apiResponse(cached.data, "weather-underground", {
        fetchedAt: cached.fetchedAt,
        isStale: false,
      });
    }
  } catch {
    // Cache miss
  }

  try {
    const raw = await fetchTodayObservations(env.WU_API_KEY, env.STATION_ID);
    const data = normalizeObservations(raw);

    await setCache(env.WEATHER_CACHE, cacheKey, data, CACHE_TTL.today);

    return apiResponse(data, "weather-underground");
  } catch (err) {
    try {
      const stale = await getCached(env.WEATHER_CACHE, `${cacheKey}:backup`);
      if (stale) {
        return apiResponse(stale.data, "weather-underground", {
          fetchedAt: stale.fetchedAt,
          isStale: true,
        });
      }
    } catch {
      // No stale data
    }

    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(`Failed to fetch today observations: ${message}`);
  }
};
