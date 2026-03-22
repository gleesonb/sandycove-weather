import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getCached, setCache } from "@/lib/cache";
import { apiResponse, errorResponse } from "@/lib/response";
import { CACHE_TTL } from "@/lib/types";
import { fetchWarnings } from "@/lib/providers/met-eireann";

export const GET: APIRoute = async () => {
  const cacheKey = "warnings";

  // Try cache first
  try {
    const cached = await getCached(env.WEATHER_CACHE, cacheKey);
    if (cached) {
      return apiResponse(cached.data, "met-eireann", {
        fetchedAt: cached.fetchedAt,
        isStale: false,
      });
    }
  } catch {
    // Cache miss or error, proceed to fetch
  }

  // Fetch fresh
  try {
    const data = await fetchWarnings();

    // Store in cache with TTL
    await setCache(env.WEATHER_CACHE, cacheKey, data, CACHE_TTL.warnings);

    // Also store a backup for stale fallback (long TTL)
    await setCache(env.WEATHER_CACHE, `${cacheKey}:backup`, data, 86400);

    return apiResponse(data, "met-eireann");
  } catch (err) {
    // Try stale cache
    try {
      const stale = await getCached(env.WEATHER_CACHE, `${cacheKey}:backup`);
      if (stale) {
        return apiResponse(stale.data, "met-eireann", {
          fetchedAt: stale.fetchedAt,
          isStale: true,
          fallbackUsed: true,
        });
      }
    } catch {
      // No stale data available
    }

    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(`Failed to fetch warnings: ${message}`);
  }
};
