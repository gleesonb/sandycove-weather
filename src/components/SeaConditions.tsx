import { useQuery } from "@tanstack/react-query";
import type { ApiResponse, SeaConditions as SeaConditionsType, TideEvent } from "@/lib/types";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IE", {
    timeZone: "Europe/Dublin",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function degreesToCompass(deg: number): string {
  const dirs = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
  ];
  return dirs[Math.round(deg / 22.5) % 16];
}

function WaveArrow({ degrees }: { degrees: number }) {
  return (
    <span
      className="inline-block text-base opacity-60"
      style={{ transform: `rotate(${degrees + 180}deg)` }}
      title={`${degrees}`}
    >
      ↑
    </span>
  );
}

function getNextTide(tides: TideEvent[]): TideEvent | null {
  const now = new Date();
  for (const tide of tides) {
    if (new Date(tide.time) > now) return tide;
  }
  return null;
}

export default function SeaConditions() {
  const { data, isLoading, error } = useQuery<ApiResponse<SeaConditionsType>>({
    queryKey: ["sea"],
    queryFn: async () => {
      const res = await fetch("/api/sea");
      if (!res.ok) throw new Error("Failed to fetch sea conditions");
      return res.json();
    },
    refetchInterval: 30 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-24 card bg-ocean-100/50 dark:bg-white/[0.04]" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[72px] card bg-ocean-100/50 dark:bg-white/[0.04]" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="card-solid bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/40 p-4 text-red-700 dark:text-red-300 text-sm">
        Failed to load sea conditions.
      </div>
    );
  }

  const sea = data.data;
  const nextTide = getNextTide(sea.tides);

  return (
    <div className="space-y-3">
      {/* Sea temperature hero */}
      <div className="card p-6 text-center">
        <div className="stat-label mb-1">Sea Temperature</div>
        <div className="font-display text-5xl sm:text-6xl font-light tabular-nums tracking-tight text-ocean-900 dark:text-white">
          {sea.seaTemp.toFixed(1)}
          <span className="text-2xl sm:text-3xl text-ocean-400 dark:text-ocean-400 ml-0.5">°C</span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-3.5">
          <div className="stat-label">Wave Height</div>
          <div className="stat-value">{sea.waveHeight.toFixed(1)} m</div>
        </div>
        <div className="card p-3.5">
          <div className="stat-label">Wave Period</div>
          <div className="stat-value">{sea.wavePeriod.toFixed(0)} s</div>
        </div>
        <div className="card p-3.5">
          <div className="stat-label">Wave Direction</div>
          <div className="stat-value">
            <WaveArrow degrees={sea.waveDirection} /> {degreesToCompass(sea.waveDirection)}
          </div>
        </div>

        {/* Next tide */}
        {nextTide && (
          <div className="card p-3.5 border-ocean-300/50 dark:border-ocean-600/30 bg-ocean-50/50 dark:bg-ocean-950/20">
            <div className="stat-label">
              Next {nextTide.type === "high" ? "High" : "Low"} Tide
            </div>
            <div className="stat-value">{formatTime(nextTide.time)}</div>
            <div className="stat-sub">{nextTide.height.toFixed(2)} m</div>
          </div>
        )}
      </div>

      {/* Tide schedule */}
      {sea.tides.length > 0 && (
        <div className="card p-4">
          <div className="stat-label mb-2">Today's Tides</div>
          <div className="flex flex-wrap gap-3">
            {sea.tides.map((tide, i) => {
              const isNext = nextTide && tide.time === nextTide.time;
              return (
                <div
                  key={i}
                  className={`flex items-center gap-2 text-sm ${
                    isNext
                      ? "font-medium text-ocean-700 dark:text-ocean-300"
                      : "text-gray-600 dark:text-gray-400"
                  }`}
                >
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      tide.type === "high"
                        ? "bg-ocean-500 dark:bg-ocean-400"
                        : "bg-gray-400 dark:bg-gray-500"
                    }`}
                  />
                  <span className="capitalize">{tide.type}</span>
                  <span className="tabular-nums">{formatTime(tide.time)}</span>
                  <span className="opacity-60 tabular-nums">{tide.height.toFixed(2)}m</span>
                  {isNext && (
                    <span className="text-[10px] uppercase tracking-wider bg-ocean-100 dark:bg-ocean-900/50 text-ocean-600 dark:text-ocean-300 px-1.5 py-0.5 rounded">
                      next
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
