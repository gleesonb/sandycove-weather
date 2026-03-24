/** OpenWeatherMap provider using 5-day forecast endpoint */

import type { ForecastHour, ForecastDay } from "@/lib/types";
import { generateWeatherForecast } from "@/lib/ai";

const API_KEY = "6ad07723086cbffbb23cba015b9658e6";
const BASE_URL = "https://api.openweathermap.org/data/2.5/forecast";
const LAT = 53.29;
const LON = -6.11;

/** OpenWeatherMap API response interfaces */
interface OWMWeather {
  id: number;
  main: string;
  description: string;
  icon: string;
}

interface OWMMain {
  temp: number;
  feels_like: number;
  humidity: number;
  pressure: number;
}

interface OWMWind {
  speed: number;
  gust: number;
  deg: number;
}

interface OWMClouds {
  all: number;
}

interface OWMRain {
  "1h"?: number;
  "3h"?: number;
}

interface OWMSnow {
  "1h"?: number;
  "3h"?: number;
}

interface OWMListItem {
  dt: number;
  main: OWMMain;
  weather: OWMWeather[];
  wind: OWMWind;
  clouds: OWMClouds;
  rain?: OWMRain;
  snow?: OWMSnow;
  visibility: number;
  pop: number;
  dt_txt: string;
}

interface OWMCity {
  id: number;
  name: string;
  coord: { lat: number; lon: number };
  country: string;
  population: number;
  timezone: number;
  sunrise: number;
  sunset: number;
}

interface OWMResponse {
  cod: string;
  message: number;
  cnt: number;
  list: OWMListItem[];
  city: OWMCity;
}

/** OpenWeatherMap icon code to standard icon name (matching component iconMap) */
const OWM_ICON_MAP: Record<string, { description: string; icon: string }> = {
  // Clear sky
  "01d": { description: "Clear sky", icon: "sun" },
  "01n": { description: "Clear sky", icon: "sun" },

  // Few clouds
  "02d": { description: "Partly cloudy", icon: "partly-cloudy" },
  "02n": { description: "Partly cloudy", icon: "partly-cloudy" },

  // Scattered clouds
  "03d": { description: "Partly cloudy", icon: "partly-cloudy" },
  "03n": { description: "Partly cloudy", icon: "partly-cloudy" },

  // Broken clouds
  "04d": { description: "Overcast", icon: "cloud" },
  "04n": { description: "Overcast", icon: "cloud" },

  // Shower rain
  "09d": { description: "Rain showers", icon: "rain" },
  "09n": { description: "Rain showers", icon: "rain" },

  // Rain (light/intensity)
  "10d": { description: "Light rain", icon: "rain" },
  "10n": { description: "Light rain", icon: "rain" },

  // Thunderstorm
  "11d": { description: "Thunderstorm", icon: "thunder" },
  "11n": { description: "Thunderstorm", icon: "thunder" },

  // Snow
  "13d": { description: "Snow", icon: "snow" },
  "13n": { description: "Snow", icon: "snow" },

  // Mist/fog
  "50d": { description: "Fog", icon: "fog" },
  "50n": { description: "Fog", icon: "fog" },
};

function owmIconLookup(iconCode: string): { description: string; icon: string } {
  return OWM_ICON_MAP[iconCode] ?? { description: "Unknown", icon: "cloudy" };
}

function degreesToCompass(deg: number): string {
  const dirs = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
  ];
  return dirs[Math.round(deg / 22.5) % 16];
}

async function fetchForecast(): Promise<OWMResponse> {
  const params = new URLSearchParams({
    lat: LAT.toString(),
    lon: LON.toString(),
    appid: API_KEY,
    units: "metric",
  });

  const url = `${BASE_URL}?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`OpenWeatherMap failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as OWMResponse;
  if (data.cod !== "200") {
    throw new Error(`OpenWeatherMap API error: ${data.message}`);
  }

  return data;
}

export async function fetchHourlyForecast(): Promise<ForecastHour[]> {
  const data = await fetchForecast();

  return data.list.map((item): ForecastHour => {
    const weather = item.weather[0];
    const iconData = owmIconLookup(weather.icon);

    return {
      timestamp: new Date(item.dt * 1000).toISOString(),
      temperature: item.main.temp,
      feelsLike: item.main.feels_like,
      humidity: item.main.humidity,
      windSpeed: item.wind.speed,
      windGust: item.wind.gust ?? 0,
      windDirection: degreesToCompass(item.wind.deg),
      precipitation: (item.rain?.["1h"] ?? item.snow?.["1h"] ?? 0) + (item.rain?.["3h"] ?? item.snow?.["3h"] ?? 0) / 3,
      precipProbability: item.pop * 100,
      description: iconData.description,
      icon: iconData.icon,
    };
  });
}

export async function fetchDailyForecast(): Promise<ForecastDay[]> {
  const data = await fetchForecast();

  // Group 3-hourly forecasts by date
  const dailyMap = new Map<string, OWMListItem[]>();

  for (const item of data.list) {
    const date = new Date(item.dt * 1000);
    const dateKey = date.toISOString().split("T")[0];

    if (!dailyMap.has(dateKey)) {
      dailyMap.set(dateKey, []);
    }
    dailyMap.get(dateKey)!.push(item);
  }

  // Aggregate to daily summaries
  return Array.from(dailyMap.entries()).map(([date, items]): ForecastDay => {
    // Use midday item for icon/description (around 12:00-15:00)
    const middayItem = items.find((item) => {
      const hour = new Date(item.dt * 1000).getHours();
      return hour >= 12 && hour <= 15;
    }) ?? items[0];

    const weather = middayItem.weather[0];
    const iconData = owmIconLookup(weather.icon);

    // Temperature extremes
    const tempHigh = Math.max(...items.map((i) => i.main.temp_max ?? i.main.temp));
    const tempLow = Math.min(...items.map((i) => i.main.temp_min ?? i.main.temp));

    // Wind extremes
    const windSpeedMax = Math.max(...items.map((i) => i.wind.speed));
    const windGustMax = Math.max(...items.map((i) => i.wind.gust ?? 0));

    // Precipitation sum (sum of 3h values, convert to mm)
    const precipSum = items.reduce((sum, item) => {
      const rain3h = item.rain?.["3h"] ?? 0;
      const snow3h = item.snow?.["3h"] ?? 0;
      return sum + rain3h + snow3h;
    }, 0);

    // Max precipitation probability
    const precipProbMax = Math.max(...items.map((i) => i.pop)) * 100;

    // Average humidity
    const humidityAvg = items.reduce((sum, i) => sum + i.main.humidity, 0) / items.length;

    // Dominant wind direction (average degrees)
    const avgWindDeg = items.reduce((sum, i) => sum + i.wind.deg, 0) / items.length;

    // Sunrise/sunset from city data
    const sunrise = new Date(data.city.sunrise * 1000).toISOString();
    const sunset = new Date(data.city.sunset * 1000).toISOString();

    return {
      date,
      tempHigh,
      tempLow,
      description: iconData.description,
      icon: iconData.icon,
      precipitation: precipSum,
      precipProbability: precipProbMax,
      windSpeed: windSpeedMax,
      windGust: windGustMax,
      windDirection: degreesToCompass(avgWindDeg),
      humidity: Math.round(humidityAvg),
      sunrise,
      sunset,
    };
  });
}

export async function fetchTextForecast(): Promise<{ text: string; issued: string }> {
  // Fetch hourly and daily forecasts to use as context for AI
  const [hourly, daily] = await Promise.all([
    fetchHourlyForecast(),
    fetchDailyForecast(),
  ]);

  // Generate AI-powered text forecast
  const text = await generateWeatherForecast({ hourly, daily });

  return {
    text,
    issued: new Date().toISOString(),
  };
}
