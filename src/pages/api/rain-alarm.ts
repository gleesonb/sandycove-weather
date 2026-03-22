import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getCached, setCache } from "@/lib/cache";
import { apiResponse, errorResponse } from "@/lib/response";
import type { RainAlarm } from "@/lib/types";
import { CACHE_TTL } from "@/lib/types";

const OPEN_METEO_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=53.2867&longitude=-6.1179&minutely_15=precipitation&forecast_minutely_15=24&timezone=Europe/Dublin";

interface OpenMeteoMinutelyResponse {
  minutely_15?: {
    time: string[];
    precipitation: (number | null)[];
  };
}

function normalizeRainAlarm(raw: OpenMeteoMinutelyResponse): RainAlarm {
  const m = raw.minutely_15;
  if (!m || !m.time) {
    return {
      minutely: [],
      summary: "No rain data available",
      rainExpected: false,
      minutesToRain: null,
    };
  }

  const minutely = m.time.map((time, i) => ({
    timestamp: new Date(time).toISOString(),
    precipitation: m.precipitation[i] ?? 0,
  }));

  const currentlyRaining = minutely.length > 0 && minutely[0].precipitation > 0;
  const firstRainIndex = minutely.findIndex((p) => p.precipitation > 0);
  const firstDryIndex = currentlyRaining
    ? minutely.findIndex((p) => p.precipitation === 0)
    : -1;

  const rainExpected = firstRainIndex !== -1;
  const minutesToRain =
    firstRainIndex > 0 ? firstRainIndex * 15 : firstRainIndex === 0 ? 0 : null;

  let summary: string;
  if (currentlyRaining) {
    if (firstDryIndex !== -1) {
      summary = `Rain ending in ~${firstDryIndex * 15} minutes`;
    } else {
      summary = "Currently raining";
    }
  } else if (firstRainIndex > 0) {
    summary = `Rain in ~${firstRainIndex * 15} minutes`;
  } else {
    summary = "No rain expected";
  }

  return { minutely, summary, rainExpected, minutesToRain };
}

export const GET: APIRoute = async () => {
  const cacheKey = "rainalarm";

  // Try cache first
  try {
    const cached = await getCached<RainAlarm>(env.WEATHER_CACHE, cacheKey);
    if (cached) {
      return apiResponse(cached.data, "open-meteo", {
        fetchedAt: cached.fetchedAt,
        isStale: false,
      });
    }
  } catch {
    // Cache miss or error, proceed to fetch
  }

  // Fetch fresh
  try {
    const res = await fetch(OPEN_METEO_URL);
    if (!res.ok) {
      throw new Error(`Open-Meteo failed: ${res.status} ${res.statusText}`);
    }
    const raw: OpenMeteoMinutelyResponse = await res.json();
    const data = normalizeRainAlarm(raw);

    await setCache(env.WEATHER_CACHE, cacheKey, data, CACHE_TTL.rainalarm);

    return apiResponse(data, "open-meteo");
  } catch (err) {
    // Try stale cache
    try {
      const stale = await getCached<RainAlarm>(
        env.WEATHER_CACHE,
        `${cacheKey}:backup`,
      );
      if (stale) {
        return apiResponse(stale.data, "open-meteo", {
          fetchedAt: stale.fetchedAt,
          isStale: true,
        });
      }
    } catch {
      // No stale data available
    }

    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(`Failed to fetch rain alarm: ${message}`);
  }
};
