import { useQuery } from "@tanstack/react-query";
import type { ApiResponse, CurrentConditions, ForecastDay, ForecastHour } from "@/lib/types";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IE", {
    timeZone: "Europe/Dublin",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function WindArrow({ degrees }: { degrees: number }) {
  return (
    <span
      className="inline-block text-base opacity-60"
      style={{ transform: `rotate(${degrees + 180}deg)` }}
      title={`${degrees}°`}
    >
      ↑
    </span>
  );
}

export default function CurrentConditions() {
  const { data, isLoading, error } = useQuery<ApiResponse<CurrentConditions>>({
    queryKey: ["current"],
    queryFn: () => fetch("/api/current").then((r) => r.json()),
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: forecastData } = useQuery<ApiResponse<{ hourly: ForecastHour[]; daily: ForecastDay[] }>>({
    queryKey: ["forecast"],
    queryFn: () => fetch("/api/forecast").then((r) => r.json()),
    refetchInterval: 30 * 60 * 1000,
  });

  const todayForecast = forecastData?.data?.daily?.[0];

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-28 card bg-ocean-100/50 dark:bg-white/[0.04]" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-[72px] card bg-ocean-100/50 dark:bg-white/[0.04]" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="card-solid bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/40 p-4 text-red-700 dark:text-red-300 text-sm">
        Failed to load current conditions.
        {data?.isStale && " Showing last known data."}
      </div>
    );
  }

  const c = data.data;

  return (
    <div className="space-y-4">
      {data.isStale && (
        <div className="card bg-amber-50/80 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-700/30 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-300">
          Data may be stale — last updated {formatTime(data.fetchedAt)}
        </div>
      )}

      {/* Hero temperature */}
      <div className="card p-8 text-center">
        <div className="font-display text-6xl sm:text-7xl font-light tabular-nums tracking-tight text-ocean-900 dark:text-gray-50">
          {c.temperature.toFixed(1)}
          <span className="text-3xl sm:text-4xl text-ocean-400 dark:text-ocean-400 ml-0.5">°C</span>
        </div>
        <div className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
          Feels like {c.feelsLike.toFixed(1)}°C
        </div>
        <div className="text-[11px] text-ocean-400/60 dark:text-ocean-300/40 mt-2 uppercase tracking-wider">
          Updated {formatTime(c.lastUpdated)}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Wind"
          value={`${c.windSpeed.toFixed(0)} km/h`}
          sub={
            <span>
              <WindArrow degrees={c.windDegrees} /> {c.windDirection}
              {c.windGust > 0 && (
                <span className="opacity-60">
                  {" "}· gust {c.windGust.toFixed(0)}
                </span>
              )}
            </span>
          }
        />
        <StatCard label="Humidity" value={`${c.humidity}%`} />
        <StatCard
          label="Pressure"
          value={`${c.pressure.toFixed(0)} hPa`}
          sub={c.pressureTrend}
        />
        <StatCard
          label="Rain"
          value={`${c.rainRate.toFixed(1)} mm/h`}
          sub={`${c.rainTotal.toFixed(1)} mm today`}
        />
        <StatCard label="UV Index" value={c.uv.toString()} sub={uvLabel(c.uv)} />
        <StatCard label="Solar" value={`${c.solarRadiation} W/m²`} />
        {todayForecast?.sunrise && (
          <StatCard label="Sunrise" value={formatTime(todayForecast.sunrise)} />
        )}
        {todayForecast?.sunset && (
          <StatCard label="Sunset" value={formatTime(todayForecast.sunset)} />
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
}) {
  return (
    <div className="card p-3.5">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function uvLabel(uv: number): string {
  if (uv <= 2) return "Low";
  if (uv <= 5) return "Moderate";
  if (uv <= 7) return "High";
  if (uv <= 10) return "Very High";
  return "Extreme";
}
