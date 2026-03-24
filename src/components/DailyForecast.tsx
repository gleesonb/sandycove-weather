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

function formatDayName(date: string): string {
  return new Date(date).toLocaleDateString("en-IE", {
    weekday: "short",
    timeZone: "Europe/Dublin",
  });
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-lg bg-white/60 dark:bg-white/[0.04] p-4 animate-pulse border border-gray-100 dark:border-white/10"
        >
          <div className="h-8 w-8 rounded-full skeleton-bg" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-20 rounded skeleton-bg" />
            <div className="h-3 w-40 rounded skeleton-bg" />
          </div>
          <div className="text-right flex-shrink-0 space-y-2">
            <div className="h-4 w-16 rounded skeleton-bg ml-auto" />
            <div className="h-3 w-14 rounded skeleton-bg ml-auto" />
            <div className="h-3 w-20 rounded skeleton-bg ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DailyForecast() {
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
      <p className="text-sm text-red-600 dark:text-red-400">Unable to load daily forecast.</p>
    );
  }

  const { daily } = data.data;

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-2">
        Daily
      </h3>
      <div className="flex flex-col gap-3">
        {daily.map((day) => (
          <div
            key={day.date}
            className="group flex items-center gap-4 rounded-lg bg-white/80 dark:bg-white/[0.06] p-4 shadow-sm dark:shadow-none border border-gray-100 dark:border-white/10 transition-all duration-200 hover:bg-white/90 dark:hover:bg-white/[0.08] hover:shadow-md dark:hover:shadow-ocean-900/20"
          >
            <div className="text-3xl opacity-90 dark:opacity-70">{getEmoji(day.icon)}</div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-gray-800 dark:text-gray-100">
                {formatDayName(day.date)}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                {day.description}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="font-semibold text-ocean-900 dark:text-ocean-50">
                {Math.round(day.tempHigh)}° / {Math.round(day.tempLow)}°
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400">
                {Math.round(day.precipProbability)}% precip
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {Math.round(day.windSpeed)} km/h {day.windDirection}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
