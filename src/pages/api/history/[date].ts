import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getCached, setCache } from "@/lib/cache";
import { apiResponse, errorResponse } from "@/lib/response";
import { CACHE_TTL } from "@/lib/types";
import {
  fetchHistory,
  normalizeObservations,
} from "@/lib/providers/wunderground";
import { fetchHistoricalObservations } from "@/lib/providers/open-meteo";
import {
  getObservationsByDate,
  saveObservations,
  saveDailySummary,
  computeDailySummary,
} from "@/lib/db";

/** Check if a YYYYMMDD date string is today in Europe/Dublin timezone */
function isToday(date: string): boolean {
  const now = new Date();
  const dublin = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Dublin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // Returns YYYY-MM-DD
  const todayCompact = dublin.replace(/-/g, "");
  return date === todayCompact;
}

/** Validate YYYYMMDD date format */
function isValidDate(date: string): boolean {
  if (!/^\d{8}$/.test(date)) return false;
  const year = parseInt(date.slice(0, 4), 10);
  const month = parseInt(date.slice(4, 6), 10);
  const day = parseInt(date.slice(6, 8), 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  if (year < 2000 || year > 2100) return false;
  // Check the date is actually valid
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

export const GET: APIRoute = async ({ params }) => {
  const date = params.date!;

  if (!isValidDate(date)) {
    return errorResponse("Invalid date format. Use YYYYMMDD.", 400);
  }

  const today = isToday(date);
  const cacheKey = `history:${date}`;
  const ttl = today ? CACHE_TTL.historyToday : CACHE_TTL.historyPast;

  // Try KV cache first
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

  // Try D1 for past dates
  if (!today) {
    try {
      const dbObs = await getObservationsByDate(
        env.WEATHER_DB,
        env.STATION_ID,
        date,
      );
      if (dbObs.length > 0) {
        // Cache in KV for future requests
        await setCache(env.WEATHER_CACHE, cacheKey, dbObs, ttl);
        return apiResponse(dbObs, "d1-cache");
      }
    } catch {
      // D1 miss, proceed to fetch
    }
  }

  // Fetch from Weather Underground
  try {
    const raw = await fetchHistory(env.WU_API_KEY, env.STATION_ID, date);
    const data = normalizeObservations(raw);

    // Store in D1 for persistence
    try {
      await saveObservations(env.WEATHER_DB, env.STATION_ID, data);

      // Compute and save daily summary for past dates
      if (!today && data.length > 0) {
        const dateStr = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
        const summary = computeDailySummary(dateStr, data);
        await saveDailySummary(env.WEATHER_DB, env.STATION_ID, summary);
      }
    } catch {
      // D1 write failure is non-fatal
    }

    // Cache in KV
    await setCache(env.WEATHER_CACHE, cacheKey, data, ttl);

    return apiResponse(data, "weather-underground");
  } catch {
    // WU failed — try Open-Meteo as fallback
    try {
      const data = await fetchHistoricalObservations(date);

      if (data.length > 0) {
        await setCache(env.WEATHER_CACHE, cacheKey, data, ttl);
        return apiResponse(data, "open-meteo", { fallbackUsed: true });
      }
    } catch {
      // Open-Meteo also failed
    }

    // Try stale KV cache
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

    return errorResponse(`Failed to fetch history for ${date}`);
  }
};
