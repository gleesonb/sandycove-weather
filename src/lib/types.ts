/** Shared types for the weather app */

export interface ApiResponse<T> {
  data: T;
  source: string;
  fetchedAt: string;
  isStale: boolean;
  fallbackUsed: boolean;
}

export interface CurrentConditions {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windGust: number;
  windDirection: string;
  windDegrees: number;
  pressure: number;
  pressureTrend: string;
  rainRate: number;
  rainTotal: number;
  uv: number;
  solarRadiation: number;
  lastUpdated: string;
  stationOnline: boolean;
}

export interface Observation {
  timestamp: string;
  temperature: number;
  humidity: number;
  windSpeed: number;
  windGust: number;
  windDirection: number;
  pressure: number;
  rainRate: number;
  rainTotal: number;
  uv: number;
  solarRadiation: number;
}

export interface ForecastHour {
  timestamp: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windGust: number;
  windDirection: string;
  precipitation: number;
  precipProbability: number;
  description: string;
  icon: string;
}

export interface ForecastDay {
  date: string;
  tempHigh: number;
  tempLow: number;
  description: string;
  icon: string;
  precipitation: number;
  precipProbability: number;
  windSpeed: number;
  windGust: number;
  windDirection: string;
  humidity: number;
  sunrise: string;
  sunset: string;
}

export interface Warning {
  id: string;
  level: "yellow" | "orange" | "red";
  type: string;
  headline: string;
  description: string;
  regions: string[];
  onset: string;
  expiry: string;
  source: string;
}

export interface HealthStatus {
  status: "ok" | "degraded" | "down";
  sources: Record<
    string,
    {
      status: "ok" | "error";
      lastSuccess: string | null;
      lastError: string | null;
    }
  >;
  timestamp: string;
}

export interface DailySummary {
  date: string;
  tempHigh: number;
  tempLow: number;
  tempAvg: number;
  humidityAvg: number;
  windMax: number;
  gustMax: number;
  rainTotal: number;
  pressureAvg: number;
}

export interface RainAlarm {
  minutely: { timestamp: string; precipitation: number }[];
  summary: string;
  rainExpected: boolean;
  minutesToRain: number | null;
}

export interface SeaConditions {
  seaTemp: number;
  waveHeight: number;
  wavePeriod: number;
  waveDirection: number;
  tides: TideEvent[];
  fetchedAt: string;
}

export interface TideEvent {
  type: "high" | "low";
  time: string;
  height: number;
}

/** Cache TTLs in seconds */
export const CACHE_TTL = {
  current: 300, // 5 min
  today: 300, // 5 min
  forecast: 1800, // 30 min
  warnings: 600, // 10 min
  historyPast: 86400, // 24h
  historyToday: 900, // 15 min
  rainalarm: 300, // 5 min
  sea: 1800, // 30 min
} as const;
