import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getCached, setCache } from "@/lib/cache";
import { apiResponse, errorResponse } from "@/lib/response";
import { CACHE_TTL } from "@/lib/types";
import type { ForecastHour, ForecastDay } from "@/lib/types";
import {
  fetchHourlyForecast as fetchOWHourly,
  fetchDailyForecast as fetchOWDaily,
} from "@/lib/providers/openweathermap";
import {
  fetchHourlyForecast as fetchOMHourly,
  fetchDailyForecast as fetchOMDaily,
} from "@/lib/providers/open-meteo";

interface ForecastData {
  hourly: ForecastHour[];
  daily: ForecastDay[];
}

export const GET: APIRoute = async () => {
  const cacheKey = "forecast";

  // Try cache first
  try {
    const cached = await getCached<ForecastData>(env.WEATHER_CACHE, cacheKey);
    if (cached) {
      return apiResponse(cached.data, "openweathermap", {
        fetchedAt: cached.fetchedAt,
        isStale: false,
      });
    }
  } catch {
    // Cache miss or error, proceed to fetch
  }

  // Try OpenWeatherMap first
  try {
    const [hourly, daily] = await Promise.all([
      fetchOWHourly(),
      fetchOWDaily(),
    ]);
    const data: ForecastData = { hourly, daily };

    await setCache(env.WEATHER_CACHE, cacheKey, data, CACHE_TTL.forecast);
    // Also store a backup for stale fallback
    await setCache(env.WEATHER_CACHE, `${cacheKey}:backup`, data, CACHE_TTL.forecast * 4);

    return apiResponse(data, "openweathermap");
  } catch {
    // OpenWeatherMap failed, try Open-Meteo fallback
  }

  // Fallback to Open-Meteo
  try {
    const [hourly, daily] = await Promise.all([
      fetchOMHourly(),
      fetchOMDaily(),
    ]);
    const data: ForecastData = { hourly, daily };

    await setCache(env.WEATHER_CACHE, cacheKey, data, CACHE_TTL.forecast);
    await setCache(env.WEATHER_CACHE, `${cacheKey}:backup`, data, CACHE_TTL.forecast * 4);

    return apiResponse(data, "open-meteo", { fallbackUsed: true });
  } catch {
    // Both providers failed
  }

  // Try stale cache
  try {
    const stale = await getCached<ForecastData>(env.WEATHER_CACHE, `${cacheKey}:backup`);
    if (stale) {
      return apiResponse(stale.data, "cached", {
        fetchedAt: stale.fetchedAt,
        isStale: true,
      });
    }
  } catch {
    // No stale data available
  }

  return errorResponse("Failed to fetch forecast from all sources");
};
