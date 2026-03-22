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
          className="flex items-center gap-4 rounded-lg bg-white/60 p-4 animate-pulse"
        >
          <div className="h-8 w-8 rounded bg-gray-200" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-20 rounded bg-gray-200" />
            <div className="h-3 w-40 rounded bg-gray-200" />
          </div>
          <div className="h-4 w-16 rounded bg-gray-200" />
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
      <p className="text-sm text-red-600">Unable to load daily forecast.</p>
    );
  }

  const { daily } = data.data;

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
        Daily
      </h3>
      <div className="flex flex-col gap-3">
        {daily.map((day) => (
          <div
            key={day.date}
            className="flex items-center gap-4 rounded-lg bg-white/80 p-4 shadow-sm"
          >
            <div className="text-3xl">{getEmoji(day.icon)}</div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-gray-800">
                {formatDayName(day.date)}
              </div>
              <div className="text-sm text-gray-500 truncate">
                {day.description}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="font-semibold">
                {Math.round(day.tempHigh)}° / {Math.round(day.tempLow)}°
              </div>
              <div className="text-xs text-blue-600">
                {Math.round(day.precipProbability)}% precip
              </div>
              <div className="text-xs text-gray-500">
                {Math.round(day.windSpeed)} km/h {day.windDirection}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
