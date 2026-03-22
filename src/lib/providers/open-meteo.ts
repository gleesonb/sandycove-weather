/** Open-Meteo forecast + history provider (fallback, no API key needed) */

import type { ForecastHour, ForecastDay, Observation } from "@/lib/types";

const BASE_URL = "https://api.open-meteo.com/v1/forecast";
const PARAMS = new URLSearchParams({
  latitude: "53.2867",
  longitude: "-6.1179",
  hourly:
    "temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation,precipitation_probability,weather_code",
  daily:
    "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,sunrise,sunset,weather_code",
  timezone: "Europe/Dublin",
});

interface OpenMeteoResponse {
  hourly?: {
    time: string[];
    temperature_2m: (number | null)[];
    apparent_temperature: (number | null)[];
    relative_humidity_2m: (number | null)[];
    wind_speed_10m: (number | null)[];
    wind_gusts_10m: (number | null)[];
    wind_direction_10m: (number | null)[];
    precipitation: (number | null)[];
    precipitation_probability: (number | null)[];
    weather_code: (number | null)[];
  };
  daily?: {
    time: string[];
    temperature_2m_max: (number | null)[];
    temperature_2m_min: (number | null)[];
    precipitation_sum: (number | null)[];
    precipitation_probability_max: (number | null)[];
    wind_speed_10m_max: (number | null)[];
    wind_gusts_10m_max: (number | null)[];
    wind_direction_10m_dominant: (number | null)[];
    sunrise: (string | null)[];
    sunset: (string | null)[];
    weather_code: (number | null)[];
  };
}

/** WMO weather code to description and icon */
const WMO_CODES: Record<number, { description: string; icon: string }> = {
  0: { description: "Clear sky", icon: "clear" },
  1: { description: "Mainly clear", icon: "mostly-clear" },
  2: { description: "Partly cloudy", icon: "partly-cloudy" },
  3: { description: "Overcast", icon: "cloudy" },
  45: { description: "Fog", icon: "fog" },
  48: { description: "Depositing rime fog", icon: "fog" },
  51: { description: "Light drizzle", icon: "drizzle" },
  53: { description: "Moderate drizzle", icon: "drizzle" },
  55: { description: "Dense drizzle", icon: "drizzle" },
  56: { description: "Light freezing drizzle", icon: "sleet" },
  57: { description: "Dense freezing drizzle", icon: "sleet" },
  61: { description: "Slight rain", icon: "rain-light" },
  63: { description: "Moderate rain", icon: "rain" },
  65: { description: "Heavy rain", icon: "rain-heavy" },
  66: { description: "Light freezing rain", icon: "sleet" },
  67: { description: "Heavy freezing rain", icon: "sleet" },
  71: { description: "Slight snow", icon: "snow-light" },
  73: { description: "Moderate snow", icon: "snow" },
  75: { description: "Heavy snow", icon: "snow-heavy" },
  77: { description: "Snow grains", icon: "snow" },
  80: { description: "Slight rain showers", icon: "rain-light" },
  81: { description: "Moderate rain showers", icon: "rain" },
  82: { description: "Violent rain showers", icon: "rain-heavy" },
  85: { description: "Slight snow showers", icon: "snow-light" },
  86: { description: "Heavy snow showers", icon: "snow-heavy" },
  95: { description: "Thunderstorm", icon: "thunderstorm" },
  96: { description: "Thunderstorm with slight hail", icon: "thunderstorm" },
  99: { description: "Thunderstorm with heavy hail", icon: "thunderstorm" },
};

function wmoLookup(code: number | null): { description: string; icon: string } {
  if (code == null) return { description: "Unknown", icon: "cloudy" };
  return WMO_CODES[code] ?? { description: `WMO ${code}`, icon: "cloudy" };
}

function degreesToCompass(deg: number): string {
  const dirs = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
  ];
  return dirs[Math.round(deg / 22.5) % 16];
}

async function fetchForecast(): Promise<OpenMeteoResponse> {
  const url = `${BASE_URL}?${PARAMS.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Open-Meteo failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function fetchHourlyForecast(): Promise<ForecastHour[]> {
  const data = await fetchForecast();
  const h = data.hourly;
  if (!h || !h.time) return [];

  return h.time.map((time, i): ForecastHour => {
    const wmo = wmoLookup(h.weather_code[i]);
    return {
      timestamp: new Date(time).toISOString(),
      temperature: h.temperature_2m[i] ?? 0,
      feelsLike: h.apparent_temperature[i] ?? h.temperature_2m[i] ?? 0,
      humidity: h.relative_humidity_2m[i] ?? 0,
      windSpeed: h.wind_speed_10m[i] ?? 0,
      windGust: h.wind_gusts_10m[i] ?? 0,
      windDirection: degreesToCompass(h.wind_direction_10m[i] ?? 0),
      precipitation: h.precipitation[i] ?? 0,
      precipProbability: h.precipitation_probability[i] ?? 0,
      description: wmo.description,
      icon: wmo.icon,
    };
  });
}

export async function fetchDailyForecast(): Promise<ForecastDay[]> {
  const data = await fetchForecast();
  const d = data.daily;
  if (!d || !d.time) return [];

  return d.time.map((date, i): ForecastDay => {
    const wmo = wmoLookup(d.weather_code[i]);
    return {
      date,
      tempHigh: d.temperature_2m_max[i] ?? 0,
      tempLow: d.temperature_2m_min[i] ?? 0,
      description: wmo.description,
      icon: wmo.icon,
      precipitation: d.precipitation_sum[i] ?? 0,
      precipProbability: d.precipitation_probability_max[i] ?? 0,
      windSpeed: d.wind_speed_10m_max[i] ?? 0,
      windGust: d.wind_gusts_10m_max[i] ?? 0,
      windDirection: degreesToCompass(d.wind_direction_10m_dominant[i] ?? 0),
      humidity: 0, // Open-Meteo doesn't provide daily humidity
      sunrise: d.sunrise[i] ?? "",
      sunset: d.sunset[i] ?? "",
    };
  });
}

/** Fetch historical hourly data from Open-Meteo Archive API */
export async function fetchHistoricalObservations(
  date: string, // YYYYMMDD
): Promise<Observation[]> {
  const formatted = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
  const params = new URLSearchParams({
    latitude: "53.2867",
    longitude: "-6.1179",
    start_date: formatted,
    end_date: formatted,
    hourly:
      "temperature_2m,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,wind_direction_10m,surface_pressure,precipitation,uv_index,shortwave_radiation",
    timezone: "Europe/Dublin",
  });

  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Open-Meteo history failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json() as {
    hourly?: {
      time: string[];
      temperature_2m: (number | null)[];
      relative_humidity_2m: (number | null)[];
      wind_speed_10m: (number | null)[];
      wind_gusts_10m: (number | null)[];
      wind_direction_10m: (number | null)[];
      surface_pressure: (number | null)[];
      precipitation: (number | null)[];
      uv_index: (number | null)[];
      shortwave_radiation: (number | null)[];
    };
  };

  const h = data.hourly;
  if (!h || !h.time) return [];

  return h.time.map((time, i): Observation => ({
    timestamp: new Date(time).toISOString(),
    temperature: h.temperature_2m[i] ?? 0,
    humidity: h.relative_humidity_2m[i] ?? 0,
    windSpeed: h.wind_speed_10m[i] ?? 0,
    windGust: h.wind_gusts_10m[i] ?? 0,
    windDirection: h.wind_direction_10m[i] ?? 0,
    pressure: h.surface_pressure[i] ?? 0,
    rainRate: h.precipitation[i] ?? 0,
    rainTotal: 0,
    uv: h.uv_index[i] ?? 0,
    solarRadiation: h.shortwave_radiation[i] ?? 0,
  }));
}
