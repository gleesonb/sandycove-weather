import { useQuery } from "@tanstack/react-query";
import type { ApiResponse, ForecastHour, SeaConditions, TideEvent } from "@/lib/types";
import { findBestSwimTime, formatDublinTime } from "@/lib/swim-score";

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

  const tides: TideEvent[] | undefined = seaData?.data?.tides;
  const scored = findBestSwimTime(data.data.hourly, tides);

  if (scored.length === 0) return null;

  const best = scored[0];

  return (
    <div className="card p-4 bg-gradient-to-r from-ocean-50/80 to-emerald-50/80 dark:from-ocean-950/30 dark:to-emerald-950/30 border-ocean-200/60 dark:border-ocean-800/40">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-ocean-600/70 dark:text-ocean-400/60 uppercase tracking-wide mb-1">
            Best time for a swim today
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg">{getRankEmoji(1)}</span>
            <span className="font-display text-xl font-semibold text-ocean-900 dark:text-ocean-100">
              {formatDublinTime(best.hour.timestamp)}
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              · {best.hour.temperature.toFixed(0)}°C
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              · {best.reasons.join(" · ")}
            </span>
            {best.tideLabel && (
              <span className="text-sm text-ocean-600/70 dark:text-ocean-400/60">
                · {best.tideLabel}
              </span>
            )}
          </div>
          {scored.length > 1 && (
            <div className="flex gap-3 mt-2 text-xs text-gray-500 dark:text-gray-500">
              <span>{getRankEmoji(2)} {formatDublinTime(scored[1].hour.timestamp)}</span>
              {scored[2] && <span>{getRankEmoji(3)} {formatDublinTime(scored[2].hour.timestamp)}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
