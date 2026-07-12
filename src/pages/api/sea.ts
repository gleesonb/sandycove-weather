import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getCached, setCache } from "@/lib/cache";
import { apiResponse, errorResponse } from "@/lib/response";
import { CACHE_TTL } from "@/lib/types";
import { fetchSeaConditions } from "@/lib/providers/sea";

export const GET: APIRoute = async () => {
  const cacheKey = "sea";

  // Try cache first
  try {
    const cached = await getCached(env.WEATHER_CACHE, cacheKey);
    if (cached) {
      return apiResponse(cached.data, cached.data.seaTempSource ?? "open-meteo-marine", {
        fetchedAt: cached.fetchedAt,
        isStale: false,
      });
    }
  } catch {
    // Cache miss or error, proceed to fetch
  }

  // Fetch fresh
  try {
    const data = await fetchSeaConditions();

    // Keep a backup copy for stale-while-error fallback.
    await setCache(env.WEATHER_CACHE, cacheKey, data, CACHE_TTL.sea);
    await setCache(env.WEATHER_CACHE, `${cacheKey}:backup`, data, CACHE_TTL.sea * 24);

    return apiResponse(data, data.seaTempSource ?? "open-meteo-marine");
  } catch (err) {
    // Try stale cache
    try {
      const stale = await getCached(env.WEATHER_CACHE, `${cacheKey}:backup`);
      if (stale) {
        return apiResponse(stale.data, stale.data.seaTempSource ?? "open-meteo-marine", {
          fetchedAt: stale.fetchedAt,
          isStale: true,
        });
      }
    } catch {
      // No stale data available
    }

    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(`Failed to fetch sea conditions: ${message}`);
  }
};
