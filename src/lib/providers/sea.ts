/** Sea conditions provider: Open-Meteo Marine API + tidetimes.org.uk scraping */

import type { SeaConditions, TideEvent } from "@/lib/types";

const MARINE_URL =
  "https://marine-api.open-meteo.com/v1/marine?latitude=53.29&longitude=-6.12&current=sea_surface_temperature,wave_height,wave_period,wave_direction&timezone=Europe/Dublin";

const TIDES_URL = "https://www.tidetimes.org.uk/dun-laoghaire-tide-times";

interface MarineResponse {
  current?: {
    sea_surface_temperature?: number;
    wave_height?: number;
    wave_period?: number;
    wave_direction?: number;
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
  const res = await fetch(TIDES_URL, {
    headers: {
      "User-Agent": "SandycoveWeather/1.0",
    },
  });
  if (!res.ok) {
    throw new Error(`Tides fetch failed: ${res.status} ${res.statusText}`);
  }
  const html = await res.text();

  const tides: TideEvent[] = [];

  // Build today's date string in Europe/Dublin timezone
  const now = new Date();
  const dublinDate = now.toLocaleDateString("en-CA", {
    timeZone: "Europe/Dublin",
  }); // YYYY-MM-DD

  // Match tide entries: look for patterns with High/Low, time (HH:MM), and height (X.XXm)
  // tidetimes.org.uk uses structured HTML with tide info
  // Pattern examples: "High Tide ... 03:42 ... 3.82m" or similar structures
  const tidePattern =
    /(High|Low)\s+Tide[^]*?(\d{1,2}:\d{2})[^]*?(\d+\.\d+)\s*m/gi;
  let match;

  while ((match = tidePattern.exec(html)) !== null) {
    const type = match[1].toLowerCase() as "high" | "low";
    const timeStr = match[2];
    const height = parseFloat(match[3]);

    // Construct ISO timestamp
    const isoTime = `${dublinDate}T${timeStr.padStart(5, "0")}:00`;
    // Create a Date in Dublin timezone and convert to ISO
    const dateObj = new Date(isoTime + "+00:00"); // Approximate; tide times are local
    // For Dublin timezone, we store the local time as ISO for display purposes
    tides.push({
      type,
      time: `${dublinDate}T${timeStr.padStart(5, "0")}:00.000Z`,
      height,
    });
  }

  return tides;
}

export async function fetchSeaConditions(): Promise<SeaConditions> {
  const [marine, tides] = await Promise.all([
    fetchMarineData(),
    fetchTides().catch(() => [] as TideEvent[]), // Tides are non-critical
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
