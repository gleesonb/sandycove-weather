/** Sea conditions provider: Open-Meteo Marine API + Marine Institute ERDDAP tides */

import type { SeaConditions, TideEvent } from "@/lib/types";

const MARINE_URL =
  "https://marine-api.open-meteo.com/v1/marine?latitude=53.29&longitude=-6.12&current=sea_surface_temperature,wave_height,wave_period,wave_direction&timezone=Europe/Dublin";

interface MarineResponse {
  current?: {
    sea_surface_temperature?: number;
    wave_height?: number;
    wave_period?: number;
    wave_direction?: number;
  };
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
  const [marine, tides] = await Promise.all([
    fetchMarineData(),
    fetchTides().catch(() => [] as TideEvent[]),
  ]);

  return {
    seaTemp: marine.seaTemp,
    waveHeight: marine.waveHeight,
    wavePeriod: marine.wavePeriod,
    waveDirection: marine.waveDirection,
    tides,
    fetchedAt: new Date().toISOString(),
  };
}
