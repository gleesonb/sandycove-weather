import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getCached, setCache } from "@/lib/cache";
import { apiResponse, errorResponse } from "@/lib/response";
import { CACHE_TTL } from "@/lib/types";
import { fetchTextForecast } from "@/lib/providers/openweathermap";

interface TextForecastData {
  text: string;
  issued: string;
}

export const GET: APIRoute = async () => {
  const cacheKey = "forecast:text";

  // Try cache first
  try {
    const cached = await getCached<TextForecastData>(env.WEATHER_CACHE, cacheKey);
    if (cached) {
      return apiResponse(cached.data, "openweathermap", {
        fetchedAt: cached.fetchedAt,
        isStale: false,
      });
    }
  } catch {
    // Cache miss or error, proceed to fetch
  }

  // Fetch fresh
  try {
    const data = await fetchTextForecast();

    await setCache(env.WEATHER_CACHE, cacheKey, data, CACHE_TTL.forecast);
    await setCache(env.WEATHER_CACHE, `${cacheKey}:backup`, data, CACHE_TTL.forecast * 4);

    return apiResponse(data, "openweathermap");
  } catch (err) {
    // Try stale cache
    try {
      const stale = await getCached<TextForecastData>(env.WEATHER_CACHE, `${cacheKey}:backup`);
      if (stale) {
        return apiResponse(stale.data, "openweathermap", {
          fetchedAt: stale.fetchedAt,
          isStale: true,
        });
      }
    } catch {
      // No stale data available
    }

    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(`Failed to fetch text forecast: ${message}`);
  }
};
