import { useQuery } from "@tanstack/react-query";
import type { ApiResponse, ForecastHour } from "@/lib/types";

interface SwimScore {
  hour: ForecastHour;
  score: number;
  reason: string;
}

function scoreSwimConditions(hour: ForecastHour): SwimScore {
  let score = 100;
  const reasons: string[] = [];

  // Temperature (feels like matters more)
  const feelsLike = hour.feelsLike;
  if (feelsLike >= 15) {
    score += 10;
  } else if (feelsLike >= 10) {
    score += 5;
  } else if (feelsLike < 5) {
    score -= 15;
    reasons.push("Cold");
  }

  // Wind
  if (hour.windSpeed < 10) {
    score += 15;
  } else if (hour.windSpeed < 20) {
    score += 5;
  } else if (hour.windSpeed >= 30) {
    score -= 20;
    reasons.push("Windy");
  }

  // Rain
  if (hour.precipitation === 0 && hour.precipProbability < 20) {
    score += 20;
  } else if (hour.precipProbability >= 50) {
    score -= 25;
    reasons.push("Rain likely");
  }

  // UV (for sun protection awareness)
  if (hour.uv > 7) {
    reasons.push("High UV");
  }

  // Daylight
  const hourNum = new Date(hour.timestamp).getHours();
  if (hourNum >= 6 && hourNum <= 20) {
    score += 10; // Daylight bonus
  }

  const reasonText = reasons.length > 0 ? reasons.join(" · ") : "Great conditions";

  return {
    hour,
    score: Math.max(0, Math.min(100, score)),
    reason: reasonText,
  };
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString("en-IE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Dublin",
  });
}

function getRankEmoji(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return "🏊";
}

export default function BestSwimTime() {
  const { data, isLoading } = useQuery<ApiResponse<{ hourly: ForecastHour[] }>>({
    queryKey: ["forecast"],
    queryFn: () => fetch("/api/forecast").then((r) => r.json()),
    refetchInterval: 30 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="card p-4 animate-pulse">
        <div className="h-20 bg-ocean-100/50 dark:bg-white/[0.04] rounded" />
      </div>
    );
  }

  if (!data?.data) return null;

  const now = new Date();
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  // Score each hour today
  const scored = data.data.hourly
    .filter((h) => {
      const hTime = new Date(h.timestamp);
      return hTime >= now && hTime <= todayEnd;
    })
    .map(scoreSwimConditions)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (scored.length === 0) return null;

  const best = scored[0];

  return (
    <div className="card p-4 bg-gradient-to-r from-ocean-50/80 to-emerald-50/80 dark:from-ocean-950/30 dark:to-emerald-950/30 border-ocean-200/60 dark:border-ocean-800/40">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-ocean-600/70 dark:text-ocean-400/60 uppercase tracking-wide mb-1">
            Best time for a swim today
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg">{getRankEmoji(1)}</span>
            <span className="font-display text-xl font-semibold text-ocean-900 dark:text-ocean-100">
              {formatTime(best.hour.timestamp)}
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              · {best.hour.temperature.toFixed(0)}°C
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              · {best.reason}
            </span>
          </div>
          {scored.length > 1 && (
            <div className="flex gap-3 mt-2 text-xs text-gray-500 dark:text-gray-500">
              <span>{getRankEmoji(2)} {formatTime(scored[1].hour.timestamp)}</span>
              {scored[2] && <span>{getRankEmoji(3)} {formatTime(scored[2].hour.timestamp)}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
