/** Met Eireann forecast provider */

import type { ForecastHour, ForecastDay } from "@/lib/types";

const HOURLY_URL = "https://prodapi.metweb.ie/hourly/53.2867/-6.1179";
const DAILY_URL = "https://prodapi.metweb.ie/daily/53.2867/-6.1179";
const TEXT_URL = "https://www.met.ie/Open_Data/json/National.json";

/** Raw hourly forecast entry from Met Eireann */
interface MEHourlyRaw {
  date?: string;
  time?: string;
  datetime?: string;
  temperature?: number;
  feelsLikeTemperature?: number;
  feelsLike?: number;
  humidity?: number;
  windSpeed?: number;
  windGust?: number;
  windDirection?: string;
  windDirectionDeg?: number;
  rainfall?: number;
  precipitation?: number;
  precipProbability?: number;
  rainChance?: number;
  weatherDescription?: string;
  description?: string;
  weatherCode?: string;
  weatherType?: string;
  icon?: string;
}

/** Raw daily forecast entry from Met Eireann */
interface MEDailyRaw {
  date?: string;
  maxTemperature?: number;
  maxTemp?: number;
  tempHigh?: number;
  minTemperature?: number;
  minTemp?: number;
  tempLow?: number;
  description?: string;
  weatherDescription?: string;
  rainfall?: number;
  precipitation?: number;
  precipProbability?: number;
  rainChance?: number;
  windSpeed?: number;
  windGust?: number;
  windDirection?: string;
  windDirectionDeg?: number;
  humidity?: number;
  sunrise?: string;
  sunset?: string;
  icon?: string;
  weatherCode?: string;
  weatherType?: string;
}

/** Raw text forecast from Met Eireann */
interface METextForecastRaw {
  national?: string;
  forecast?: string;
  body?: string;
  issued?: string;
  date?: string;
  updated?: string;
}

function degreesToCompass(deg: number): string {
  const dirs = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
  ];
  return dirs[Math.round(deg / 22.5) % 16];
}

function resolveTimestamp(raw: MEHourlyRaw): string {
  if (raw.datetime) return new Date(raw.datetime).toISOString();
  if (raw.date && raw.time) return new Date(`${raw.date}T${raw.time}`).toISOString();
  if (raw.date) return new Date(raw.date).toISOString();
  return new Date().toISOString();
}

function resolveWindDir(direction?: string, degrees?: number): string {
  if (direction) return direction;
  if (degrees != null) return degreesToCompass(degrees);
  return "N";
}

function normalizeHourly(raw: MEHourlyRaw): ForecastHour {
  return {
    timestamp: resolveTimestamp(raw),
    temperature: raw.temperature ?? 0,
    feelsLike: raw.feelsLikeTemperature ?? raw.feelsLike ?? raw.temperature ?? 0,
    humidity: raw.humidity ?? 0,
    windSpeed: raw.windSpeed ?? 0,
    windGust: raw.windGust ?? 0,
    windDirection: resolveWindDir(raw.windDirection, raw.windDirectionDeg),
    precipitation: raw.rainfall ?? raw.precipitation ?? 0,
    precipProbability: raw.precipProbability ?? raw.rainChance ?? 0,
    description: raw.weatherDescription ?? raw.description ?? "",
    icon: raw.icon ?? raw.weatherCode ?? raw.weatherType ?? "cloudy",
  };
}

function normalizeDaily(raw: MEDailyRaw): ForecastDay {
  return {
    date: raw.date ?? new Date().toISOString().slice(0, 10),
    tempHigh: raw.maxTemperature ?? raw.maxTemp ?? raw.tempHigh ?? 0,
    tempLow: raw.minTemperature ?? raw.minTemp ?? raw.tempLow ?? 0,
    description: raw.description ?? raw.weatherDescription ?? "",
    icon: raw.icon ?? raw.weatherCode ?? raw.weatherType ?? "cloudy",
    precipitation: raw.rainfall ?? raw.precipitation ?? 0,
    precipProbability: raw.precipProbability ?? raw.rainChance ?? 0,
    windSpeed: raw.windSpeed ?? 0,
    windGust: raw.windGust ?? 0,
    windDirection: resolveWindDir(raw.windDirection, raw.windDirectionDeg),
    humidity: raw.humidity ?? 0,
    sunrise: raw.sunrise ?? "",
    sunset: raw.sunset ?? "",
  };
}

export async function fetchHourlyForecast(): Promise<ForecastHour[]> {
  const res = await fetch(HOURLY_URL, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Met Eireann hourly failed: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  const rawEntries: MEHourlyRaw[] = Array.isArray(json)
    ? json
    : (json.hourly ?? json.data ?? json.forecast ?? []);

  return rawEntries.map(normalizeHourly);
}

export async function fetchDailyForecast(): Promise<ForecastDay[]> {
  const res = await fetch(DAILY_URL, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Met Eireann daily failed: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  const rawEntries: MEDailyRaw[] = Array.isArray(json)
    ? json
    : (json.daily ?? json.data ?? json.forecast ?? []);

  return rawEntries.map(normalizeDaily);
}

export async function fetchTextForecast(): Promise<{
  text: string;
  issued: string;
}> {
  const res = await fetch(TEXT_URL, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Met Eireann text forecast failed: ${res.status} ${res.statusText}`);
  }

  const json = await res.json() as {
    forecasts?: Array<{
      regions?: Array<Record<string, string>>;
    }>;
  };

  // Met Éireann format: { forecasts: [{ regions: [{ region: "National" }, { issued: "..." }, { today: "..." }, ...] }] }
  const regions = json.forecasts?.[0]?.regions ?? [];
  const parts: string[] = [];
  let issued = new Date().toISOString();

  for (const entry of regions) {
    if (entry.issued) {
      issued = entry.issued;
    } else if (entry.region) {
      // skip
    } else {
      // Keys like "today", "tonight", "tomorrow", "outlook"
      const key = Object.keys(entry)[0];
      if (key && entry[key]) {
        parts.push(`${key.charAt(0).toUpperCase() + key.slice(1)}: ${entry[key]}`);
      }
    }
  }

  return { text: parts.join("\n\n"), issued };
}
