import { useQuery } from "@tanstack/react-query";
import type {
  ApiResponse,
  CurrentConditions,
  RainAlarm,
  SeaConditions,
  ForecastHour,
  ForecastDay,
} from "@/lib/types";
import { scoreNow, findBestSwimTime, formatDublinTime } from "@/lib/swim-score";
import ShareCard from "./ShareCard";

export default function SwimIndicator() {
  const { data: currentData } = useQuery<ApiResponse<CurrentConditions>>({
    queryKey: ["current"],
    queryFn: () => fetch("/api/current").then((r) => r.json()),
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: seaData } = useQuery<ApiResponse<SeaConditions>>({
    queryKey: ["sea"],
    queryFn: () => fetch("/api/sea").then((r) => r.json()),
    refetchInterval: 30 * 60 * 1000,
  });

  const { data: rainData } = useQuery<ApiResponse<RainAlarm>>({
    queryKey: ["rain-alarm"],
    queryFn: async () => {
      const res = await fetch("/api/rain-alarm");
      if (!res.ok) throw new Error("Failed to fetch rain alarm");
      return res.json();
    },
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: forecastData } = useQuery<
    ApiResponse<{ hourly: ForecastHour[]; daily: ForecastDay[] }>
  >({
    queryKey: ["forecast"],
    queryFn: () => fetch("/api/forecast").then((r) => r.json()),
    refetchInterval: 30 * 60 * 1000,
  });

  const current = currentData?.data;
  const sea = seaData?.data;
  const rain = rainData?.data;
  const forecast = forecastData?.data;

  // Need at least current conditions to show anything useful
  if (!current) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-40 card bg-ocean-100/50 dark:bg-white/[0.04]" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 card bg-ocean-100/50 dark:bg-white/[0.04]" />
          ))}
        </div>
      </div>
    );
  }

  const { factors, verdict } = scoreNow({ current, sea, rain });

  // Best swim time today, for the share card.
  const bestSwimToday = forecast ? findBestSwimTime(forecast.hourly, sea?.tides, 1)[0] : undefined;

  return (
    <div className={`card p-6 sm:p-8 ${verdict.bg} ${verdict.border}`}>
      {/* Verdict heading */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <span className="text-3xl" role="img" aria-hidden="true">
            {verdict.emoji}
          </span>
          <div>
            <h2 className={`font-display text-2xl sm:text-3xl font-semibold tracking-tight ${verdict.textColor}`}>
              {verdict.text}
            </h2>
            <p className={`text-sm mt-0.5 ${verdict.subTextColor}`}>
              Forty Foot, Sandycove
              {!sea && " · Sea data loading…"}
            </p>
          </div>
        </div>
        <ShareCard
          verdict={verdict}
          temp={current.temperature}
          windSpeed={current.windSpeed}
          rainExpected={rain ? rain.rainExpected : false}
          seaTemp={sea?.seaTemp}
          tideInfo={(() => {
            if (!sea?.tides?.length) return undefined;
            const now = Date.now();
            const next = sea.tides.find((t) => new Date(t.time).getTime() > now);
            if (!next) return undefined;
            const time = formatDublinTime(next.time);
            return `Next ${next.type === "high" ? "high" : "low"} tide ${time}`;
          })()}
          bestSwimTime={bestSwimToday ? formatDublinTime(bestSwimToday.hour.timestamp) : undefined}
        />
      </div>

      {/* Breakdown grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {factors.map((item) => (
          <div key={item.key} className="card p-3.5">
            <div className="flex items-start gap-2">
              <span className="text-base mt-0.5 shrink-0" role="img" aria-hidden="true">
                {item.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <div className="stat-label">{item.label}</div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-50 mt-0.5">
                  {item.detail}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
