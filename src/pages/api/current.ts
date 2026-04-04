import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getCached, setCache } from "@/lib/cache";
import { apiResponse, errorResponse } from "@/lib/response";
import { CACHE_TTL } from "@/lib/types";
import {
  fetchCurrentConditions,
  fetchTodayObservations,
  normalizeCurrentConditions,
} from "@/lib/providers/wunderground";
import { fetchCurrentSupplement } from "@/lib/providers/open-meteo";

export const GET: APIRoute = async () => {
  const cacheKey = "current";

  // Try cache first
  try {
    const cached = await getCached(env.WEATHER_CACHE, cacheKey);
    if (cached) {
      return apiResponse(cached.data, "weather-underground", {
        fetchedAt: cached.fetchedAt,
        isStale: false,
      });
    }
  } catch {
    // Cache miss or error, proceed to fetch
  }

  // Fetch fresh (parallel requests for current + history + supplement)
  try {
    const [rawCurrent, rawHistory, supplement] = await Promise.all([
      fetchCurrentConditions(env.WU_API_KEY, env.STATION_ID),
      fetchTodayObservations(env.WU_API_KEY, env.STATION_ID).catch(() => null), // optional, fail gracefully
      fetchCurrentSupplement().catch(() => null), // visibility + UV from Open-Meteo
    ]);

    const data = normalizeCurrentConditions(rawCurrent, rawHistory ?? undefined, supplement ?? undefined);

    await setCache(env.WEATHER_CACHE, cacheKey, data, CACHE_TTL.current);

    return apiResponse(data, "weather-underground");
  } catch (err) {
    // Try stale cache
    try {
      const stale = await getCached(env.WEATHER_CACHE, `${cacheKey}:backup`);
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
