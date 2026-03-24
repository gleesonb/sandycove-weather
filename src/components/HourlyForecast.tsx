import { useQuery } from "@tanstack/react-query";
import type { ApiResponse, ForecastHour, ForecastDay } from "../lib/types";

interface ForecastData {
  hourly: ForecastHour[];
  daily: ForecastDay[];
}

const iconMap: Record<string, string> = {
  sun: "☀️",
  cloud: "☁️",
  rain: "🌧️",
  snow: "🌨️",
  thunder: "⛈️",
  fog: "🌫️",
  "partly-cloudy": "⛅",
};

function getEmoji(icon: string): string {
  return iconMap[icon] ?? "🌤️";
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString("en-IE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Dublin",
  });
}

function LoadingSkeleton() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="w-20 flex-shrink-0 rounded-lg bg-white/60 dark:bg-white/[0.04] p-3 animate-pulse border border-gray-100 dark:border-white/10"
        >
          <div className="h-3 w-10 rounded bg-gray-200 dark:bg-white/10 mb-2" />
          <div className="h-6 w-6 rounded bg-gray-200 dark:bg-white/10 mx-auto mb-2" />
          <div className="h-4 w-8 rounded bg-gray-200 dark:bg-white/10 mx-auto mb-1" />
          <div className="h-3 w-12 rounded bg-gray-200 dark:bg-white/10 mx-auto mb-1" />
          <div className="h-3 w-10 rounded bg-gray-200 dark:bg-white/10 mx-auto" />
        </div>
      ))}
    </div>
  );
}

export default function HourlyForecast() {
  const { data, isLoading, isError } = useQuery<ApiResponse<ForecastData>>({
    queryKey: ["forecast"],
    queryFn: async () => {
      const res = await fetch("/api/forecast");
      if (!res.ok) throw new Error("Failed to fetch forecast");
      return res.json();
    },
    refetchInterval: 30 * 60 * 1000,
  });

  if (isLoading) return <LoadingSkeleton />;
  if (isError || !data) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">Unable to load hourly forecast.</p>
    );
  }

  const now = new Date().toISOString();
  const hourly = data.data.hourly.filter((h) => h.timestamp >= now);

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
          Hourly
        </h3>
        {data.isStale && (
          <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-2 py-0.5 rounded-full">
            Stale
          </span>
        )}
        {data.fallbackUsed && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Forecast from Open-Meteo
          </span>
        )}
        {!data.fallbackUsed && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Forecast from OpenWeatherMap
          </span>
        )}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {hourly.map((hour) => (
          <div
            key={hour.timestamp}
            className="w-20 flex-shrink-0 rounded-lg bg-white/80 dark:bg-white/[0.06] p-3 text-center shadow-sm dark:shadow-none border border-gray-100 dark:border-white/10"
          >
            <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              {formatTime(hour.timestamp)}
            </div>
            <div className="text-2xl my-1 opacity-90 dark:opacity-70">{getEmoji(hour.icon)}</div>
            <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              {Math.round(hour.temperature)}°
            </div>
            <div className="text-xs text-blue-600 dark:text-blue-400">
              {Math.round(hour.precipProbability)}%
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {Math.round(hour.windSpeed)} km/h
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
