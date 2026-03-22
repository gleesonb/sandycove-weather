import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getCached, setCache } from "@/lib/cache";
import { apiResponse, errorResponse } from "@/lib/response";
import { CACHE_TTL } from "@/lib/types";
import type { DailySummary, Observation } from "@/lib/types";
import {
  fetchHistory,
  normalizeObservations,
} from "@/lib/providers/wunderground";
import {
  getDailySummariesByRange,
  saveObservations,
  saveDailySummary,
  computeDailySummary,
} from "@/lib/db";

const MAX_RANGE_DAYS = 90;

/** Validate YYYYMMDD date format */
function isValidDate(date: string): boolean {
  if (!/^\d{8}$/.test(date)) return false;
  const year = parseInt(date.slice(0, 4), 10);
  const month = parseInt(date.slice(4, 6), 10);
  const day = parseInt(date.slice(6, 8), 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  if (year < 2000 || year > 2100) return false;
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

/** Parse YYYYMMDD to Date */
function parseDate(date: string): Date {
  return new Date(
    parseInt(date.slice(0, 4), 10),
    parseInt(date.slice(4, 6), 10) - 1,
    parseInt(date.slice(6, 8), 10),
  );
}

/** Format Date to YYYYMMDD */
function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/** Format Date to YYYY-MM-DD */
function formatDateDash(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Get all dates (YYYYMMDD) in a range inclusive */
function getDatesInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const startD = parseDate(start);
  const endD = parseDate(end);
  const current = new Date(startD);
  while (current <= endD) {
    dates.push(formatDate(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

/** Count days between two YYYYMMDD dates inclusive */
function daysBetween(start: string, end: string): number {
  const s = parseDate(start);
  const e = parseDate(end);
  return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

/** Determine if a date is today in Europe/Dublin timezone */
function getTodayDublin(): string {
  const now = new Date();
  const dublin = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Dublin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return dublin.replace(/-/g, "");
}

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");

  if (!start || !end) {
    return errorResponse("Missing required query params: start, end (YYYYMMDD)", 400);
  }

  if (!isValidDate(start) || !isValidDate(end)) {
    return errorResponse("Invalid date format. Use YYYYMMDD.", 400);
  }

  if (start > end) {
    return errorResponse("start date must be before or equal to end date.", 400);
  }

  const days = daysBetween(start, end);
  if (days > MAX_RANGE_DAYS) {
    return errorResponse(`Range exceeds maximum of ${MAX_RANGE_DAYS} days.`, 400);
  }

  const todayCompact = getTodayDublin();
  const includestoday = end >= todayCompact && start <= todayCompact;
  const ttl = includestoday ? CACHE_TTL.historyToday : CACHE_TTL.historyPast;
  const cacheKey = `history-range:${start}:${end}`;

  // Try KV cache first
  try {
    const cached = await getCached<DailySummary[]>(env.WEATHER_CACHE, cacheKey);
    if (cached) {
      return apiResponse(cached.data, "weather-underground", {
        fetchedAt: cached.fetchedAt,
        isStale: false,
      });
    }
  } catch {
    // Cache miss
  }

  // Try D1 for stored summaries
  try {
    const dbSummaries = await getDailySummariesByRange(
      env.WEATHER_DB,
      env.STATION_ID,
      start,
      end,
    );

    // Check if we have all days (excluding today which may be incomplete)
    const allDates = getDatesInRange(start, end).filter((d) => d !== todayCompact);
    const dbDates = new Set(dbSummaries.map((s) => s.date.replace(/-/g, "")));
    const missingDates = allDates.filter((d) => !dbDates.has(d));

    if (missingDates.length === 0 && !includestoday) {
      // All past summaries found in D1
      await setCache(env.WEATHER_CACHE, cacheKey, dbSummaries, ttl);
      return apiResponse(dbSummaries, "d1-cache");
    }

    // Fetch missing dates from WU and compute summaries
    const newSummaries: DailySummary[] = [];
    const datesToFetch = includestoday
      ? [...missingDates, todayCompact].filter(
          (d) => d >= start && d <= end,
        )
      : missingDates;

    for (const dateStr of datesToFetch) {
      try {
        const raw = await fetchHistory(env.WU_API_KEY, env.STATION_ID, dateStr);
        const observations: Observation[] = normalizeObservations(raw);

        // Persist observations to D1
        try {
          await saveObservations(env.WEATHER_DB, env.STATION_ID, observations);
        } catch {
          // Non-fatal
        }

        const dateDash = formatDateDash(parseDate(dateStr));
        const summary = computeDailySummary(dateDash, observations);

        // Save summary to D1 (skip today since it's incomplete)
        if (dateStr !== todayCompact) {
          try {
            await saveDailySummary(env.WEATHER_DB, env.STATION_ID, summary);
          } catch {
            // Non-fatal
          }
        }

        newSummaries.push(summary);
      } catch {
        // Skip dates that fail to fetch
      }
    }

    // Combine existing and new summaries, sorted by date
    const allSummaries = [...dbSummaries, ...newSummaries].sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    // Only cache non-empty results to avoid persisting transient failures
    if (allSummaries.length > 0) {
      await setCache(env.WEATHER_CACHE, cacheKey, allSummaries, ttl);
    }
    return apiResponse(allSummaries, "weather-underground");
  } catch (err) {
    // D1 failed entirely, try to fetch all from WU
    try {
      const allDates = getDatesInRange(start, end);
      const summaries: DailySummary[] = [];

      for (const dateStr of allDates) {
        try {
          const raw = await fetchHistory(env.WU_API_KEY, env.STATION_ID, dateStr);
          const observations: Observation[] = normalizeObservations(raw);
          const dateDash = formatDateDash(parseDate(dateStr));
          const summary = computeDailySummary(dateDash, observations);
          summaries.push(summary);
        } catch {
          // Skip failed dates
        }
      }

      if (summaries.length > 0) {
        await setCache(env.WEATHER_CACHE, cacheKey, summaries, ttl);
        return apiResponse(summaries, "weather-underground");
      }

      const message = err instanceof Error ? err.message : "Unknown error";
      return errorResponse(`Failed to fetch history range: ${message}`);
    } catch (fetchErr) {
      const message = fetchErr instanceof Error ? fetchErr.message : "Unknown error";
      return errorResponse(`Failed to fetch history range: ${message}`);
    }
  }
};
