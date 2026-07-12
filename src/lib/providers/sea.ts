/** Sea conditions provider:
 *  - Dublin Bay Buoy (in-situ) for sea temp + waves — primary
 *  - Open-Meteo Marine API for wave direction + fallback when the buoy is stale/down
 *  - Marine Institute ERDDAP for tides
 */

import type { SeaConditions, TideEvent } from "@/lib/types";

const MARINE_URL =
  "https://marine-api.open-meteo.com/v1/marine?latitude=53.29&longitude=-6.12&current=sea_surface_temperature,wave_height,wave_period,wave_direction&timezone=Europe/Dublin";

// Dublin Bay Buoy — free PostgREST API (https://dublinbaybuoy.com/developers).
// This is the public publishable anon key: RLS-limited to SELECT, safe to ship.
const DUBLIN_BAY_BUOY_KEY = "sb_publishable_R5KkIpbiwNajUyx3I4aewQ_S4NI8hl3";
const DUBLIN_BAY_BUOY_URL =
  "https://api.dublinbaybuoy.com/rest/v1/readings?select=timestamp,water_temp,wave_height,wave_period&order=timestamp.desc&limit=1";
const BUOY_STALE_MS = 3 * 60 * 60 * 1000; // treat buoy as stale after 3h

interface MarineResponse {
  current?: {
    sea_surface_temperature?: number;
    wave_height?: number;
    wave_period?: number;
    wave_direction?: number;
  };
}

interface BuoyReading {
  timestamp: string;
  water_temp?: number;
  wave_height?: number;
  wave_period?: number;
}

interface ErddapResponse {
  table: {
    rows: [string, number, string][];
  };
}

export async function fetchMarineData(): Promise<{
  seaTemp: number;
  waveHeight: number;
  wavePeriod: number;
  waveDirection: number;
}> {
  const res = await fetch(MARINE_URL);
  if (!res.ok) {
    throw new Error(`Marine API failed: ${res.status} ${res.statusText}`);
  }
  const data: MarineResponse = await res.json();
  const c = data.current;
  if (!c) throw new Error("Marine API returned no current data");

  return {
    seaTemp: c.sea_surface_temperature ?? 0,
    waveHeight: c.wave_height ?? 0,
    wavePeriod: c.wave_period ?? 0,
    waveDirection: c.wave_direction ?? 0,
  };
}

/** Latest in-situ reading from the Dublin Bay Buoy, or null if unavailable/stale. */
export async function fetchDublinBayBuoy(): Promise<{
  seaTemp: number;
  waveHeight: number;
  wavePeriod: number;
} | null> {
  try {
    const res = await fetch(DUBLIN_BAY_BUOY_URL, {
      headers: { apikey: DUBLIN_BAY_BUOY_KEY },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as BuoyReading[];
    const r = rows?.[0];
    if (!r || r.water_temp == null) return null;

    // Drop the reading if the buoy hasn't reported recently.
    const age = Date.now() - new Date(r.timestamp).getTime();
    if (age > BUOY_STALE_MS) return null;

    return {
      seaTemp: r.water_temp,
      waveHeight: r.wave_height ?? 0,
      wavePeriod: r.wave_period ?? 0,
    };
  } catch {
    return null;
  }
}

export async function fetchTides(): Promise<TideEvent[]> {
  // Use Marine Institute Ireland ERDDAP — Dublin Port high/low tide predictions
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfTomorrow = new Date(now);
  endOfTomorrow.setUTCDate(endOfTomorrow.getUTCDate() + 1);
  endOfTomorrow.setUTCHours(23, 59, 59, 0);

  const start = startOfDay.toISOString().replace(/\.\d+Z$/, "Z");
  const end = endOfTomorrow.toISOString().replace(/\.\d+Z$/, "Z");

  const url = `https://erddap.marine.ie/erddap/tabledap/IMI_TidePrediction_HighLow.json?time,Water_Level_ODMalin,tide_time_category&stationID=%22Dublin_Port%22&time%3E=${start}&time%3C=${end}&orderBy(%22time%22)`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`ERDDAP tides failed: ${res.status} ${res.statusText}`);
  }
  const data: ErddapResponse = await res.json();

  return data.table.rows.map((row) => {
    // Water_Level_ODMalin is relative to Ordnance Datum Malin
    // Convert to approximate chart datum by adding ~2.6m (Dun Laoghaire offset)
    const heightOD = row[1];
    const heightCD = heightOD + 2.6; // Approximate conversion to chart datum

    return {
      type: row[2] === "HIGH" ? "high" as const : "low" as const,
      time: row[0],
      height: Math.round(heightCD * 100) / 100,
    };
  });
}

export async function fetchSeaConditions(): Promise<SeaConditions> {
  const [buoy, marine, tides] = await Promise.all([
    fetchDublinBayBuoy(),
    fetchMarineData().catch(() => null),
    fetchTides().catch(() => [] as TideEvent[]),
  ]);

  // Prefer the in-situ buoy; keep the model's wave direction (buoy has none).
  if (buoy) {
    return {
      seaTemp: buoy.seaTemp,
      waveHeight: buoy.waveHeight,
      wavePeriod: buoy.wavePeriod,
      waveDirection: marine?.waveDirection ?? 0,
      tides,
      seaTempSource: "dublin-bay-buoy",
      fetchedAt: new Date().toISOString(),
    };
  }

  // Fall back to the open-meteo marine model for everything.
  if (marine) {
    return {
      seaTemp: marine.seaTemp,
      waveHeight: marine.waveHeight,
      wavePeriod: marine.wavePeriod,
      waveDirection: marine.waveDirection,
      tides,
      seaTempSource: "open-meteo-marine",
      fetchedAt: new Date().toISOString(),
    };
  }

  throw new Error("All sea data sources unavailable");
}
