/** Weather Underground API provider */

const WU_BASE = "https://api.weather.com/v2/pws";

interface WUCurrentResponse {
  observations: Array<{
    stationID: string;
    obsTimeUtc: string;
    obsTimeLocal: string;
    epoch: number;
    lat: number;
    lon: number;
    solarRadiation: number | null;
    uv: number | null;
    winddir: number | null;
    humidity: number | null;
    metric: {
      temp: number | null;
      heatIndex: number | null;
      dewpt: number | null;
      windChill: number | null;
      windSpeed: number | null;
      windGust: number | null;
      pressure: number | null;
      precipRate: number | null;
      precipTotal: number | null;
      elev: number | null;
    };
  }>;
}

interface WUObservation {
  obsTimeUtc: string;
  humidityAvg: number | null;
  humidityHigh: number | null;
  humidityLow: number | null;
  metric: {
    tempAvg: number | null;
    tempHigh: number | null;
    tempLow: number | null;
    windspeedAvg: number | null;
    windspeedHigh: number | null;
    windgustAvg: number | null;
    windgustHigh: number | null;
    pressureMax: number | null;
    pressureMin: number | null;
    precipRate: number | null;
    precipTotal: number | null;
  };
  solarRadiationHigh: number | null;
  uvHigh: number | null;
  winddirAvg: number | null;
}

interface WUHistoryResponse {
  observations: WUObservation[];
}

export async function fetchCurrentConditions(
  apiKey: string,
  stationId: string,
): Promise<WUCurrentResponse> {
  const url = `${WU_BASE}/observations/current?stationId=${stationId}&format=json&units=m&apiKey=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`WU current failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function fetchTodayObservations(
  apiKey: string,
  stationId: string,
): Promise<WUHistoryResponse> {
  const url = `${WU_BASE}/observations/all/1day?stationId=${stationId}&format=json&units=m&apiKey=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`WU today failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function fetchHistory(
  apiKey: string,
  stationId: string,
  date: string, // YYYYMMDD
): Promise<WUHistoryResponse> {
  const url = `${WU_BASE}/history/all?stationId=${stationId}&format=json&units=m&date=${date}&apiKey=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`WU history failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/** Normalize WU current response to our schema */
export function normalizeCurrentConditions(raw: WUCurrentResponse) {
  const obs = raw.observations?.[0];
  if (!obs) throw new Error("No observations in WU response");

  const m = obs.metric;
  return {
    temperature: m.temp ?? 0,
    feelsLike: m.heatIndex ?? m.windChill ?? m.temp ?? 0,
    humidity: obs.humidity ?? 0,
    windSpeed: m.windSpeed ?? 0,
    windGust: m.windGust ?? 0,
    windDirection: degreesToCompass(obs.winddir ?? 0),
    windDegrees: obs.winddir ?? 0,
    pressure: m.pressure ?? 0,
    pressureTrend: "steady", // WU doesn't provide trend in current obs
    rainRate: m.precipRate ?? 0,
    rainTotal: m.precipTotal ?? 0,
    uv: obs.uv ?? 0,
    solarRadiation: obs.solarRadiation ?? 0,
    lastUpdated: obs.obsTimeUtc,
    stationOnline: true,
  };
}

/** Normalize WU history observations to our schema */
export function normalizeObservations(raw: WUHistoryResponse) {
  return (raw.observations ?? []).map((obs) => ({
    timestamp: obs.obsTimeUtc,
    temperature: obs.metric.tempAvg ?? 0,
    humidity: obs.humidityAvg ?? 0,
    windSpeed: obs.metric.windspeedAvg ?? 0,
    windGust: obs.metric.windgustHigh ?? 0,
    windDirection: obs.winddirAvg ?? 0,
    pressure: obs.metric.pressureMax ?? 0,
    rainRate: obs.metric.precipRate ?? 0,
    rainTotal: obs.metric.precipTotal ?? 0,
    uv: obs.uvHigh ?? 0,
    solarRadiation: obs.solarRadiationHigh ?? 0,
  }));
}

function degreesToCompass(deg: number): string {
  const dirs = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
  ];
  return dirs[Math.round(deg / 22.5) % 16];
}
