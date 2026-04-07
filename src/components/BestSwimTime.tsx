import { useQuery } from "@tanstack/react-query";
import type { ApiResponse, ForecastHour, SeaConditions, TideEvent } from "@/lib/types";

interface SwimScore {
  hour: ForecastHour;
  score: number;
  reason: string;
  tideLabel?: string;
}

/** Cosine interpolation between tide points (same method as TideGraph) */
function estimateTideHeight(tides: TideEvent[], timestamp: string): number {
  const sorted = [...tides].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  const time = new Date(timestamp).getTime();

  const prev = [...sorted].reverse().find((t) => new Date(t.time).getTime() <= time);
  const next = sorted.find((t) => new Date(t.time).getTime() > time);

  if (prev && next) {
    const prevTime = new Date(prev.time).getTime();
    const nextTime = new Date(next.time).getTime();
    const progress = (time - prevTime) / (nextTime - prevTime);
    const cosValue = (1 - Math.cos(progress * Math.PI)) / 2;
    return prev.height + (next.height - prev.height) * cosValue;
  }
  if (prev) return prev.height;
  if (next) return next.height;
  return 1.5; // fallback mid-range
}

function scoreSwimConditions(hour: ForecastHour, tides?: TideEvent[]): SwimScore {
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

  // Tide — strong bias for higher tides
  let tideLabel: string | undefined;
  if (tides && tides.length >= 2) {
    const height = estimateTideHeight(tides, hour.timestamp);
    // Find the range of tide heights today
    const heights = tides.map((t) => t.height);
    const minH = Math.min(...heights);
    const maxH = Math.max(...heights);
    const range = maxH - minH;

    if (range > 0) {
      // Normalize to 0-1 where 1 = highest tide
      const normalized = (height - minH) / range;

      // Strong bias: up to +50 at high tide, -30 at low tide
      // This uses a squared curve to make high tide even more attractive
      const tideBonus = Math.round(normalized * normalized * 80 - 30);
      score += tideBonus;

      if (normalized > 0.8) {
        tideLabel = "High tide";
      } else if (normalized > 0.5) {
        tideLabel = "Tide coming in";
      } else if (normalized < 0.2) {
        tideLabel = "Low tide";
        reasons.push("Low tide");
      }
    }
  }

  const reasonText = reasons.length > 0 ? reasons.join(" · ") : "Great conditions";

  return {
    hour,
    score: Math.max(0, Math.min(100, score)),
    reason: reasonText,
    tideLabel,
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

  const { data: seaData } = useQuery<ApiResponse<SeaConditions>>({
    queryKey: ["sea"],
    queryFn: () => fetch("/api/sea").then((r) => r.json()),
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

  const tides = seaData?.data?.tides;
  const now = new Date();
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  // Score each hour today
  const scored = data.data.hourly
    .filter((h) => {
      const hTime = new Date(h.timestamp);
      return hTime >= now && hTime <= todayEnd;
    })
    .map((h) => scoreSwimConditions(h, tides))
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
            {best.tideLabel && (
              <span className="text-sm text-ocean-600/70 dark:text-ocean-400/60">
                · {best.tideLabel}
              </span>
            )}
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
