import { useQuery } from "@tanstack/react-query";
import type {
  ApiResponse,
  CurrentConditions,
  RainAlarm,
  SeaConditions,
  ForecastHour,
  ForecastDay,
} from "@/lib/types";

// --- Scoring helpers ---

function scoreSeaTemp(temp: number): { score: number; label: string } {
  if (temp >= 12) return { score: 25, label: `${temp.toFixed(1)}°C — lovely` };
  if (temp >= 10) return { score: 15, label: `${temp.toFixed(1)}°C — fresh` };
  if (temp >= 8) return { score: 8, label: `${temp.toFixed(1)}°C — cold` };
  return { score: 2, label: `${temp.toFixed(1)}°C — very cold` };
}

function scoreWind(speed: number): { score: number; label: string } {
  if (speed < 15) return { score: 25, label: `${speed.toFixed(0)} km/h — calm` };
  if (speed < 25) return { score: 15, label: `${speed.toFixed(0)} km/h — breezy` };
  if (speed < 35) return { score: 8, label: `${speed.toFixed(0)} km/h — windy` };
  return { score: 0, label: `${speed.toFixed(0)} km/h — stormy` };
}

function scoreRain(
  rainRate: number,
  rainExpected: boolean,
  minutesToRain: number | null,
): { score: number; label: string } {
  if (rainRate > 0) return { score: 0, label: "Currently raining" };
  if (!rainExpected) return { score: 25, label: "Dry skies" };
  if (minutesToRain != null && minutesToRain > 60)
    return { score: 20, label: `Rain in ~${minutesToRain} min` };
  if (minutesToRain != null && minutesToRain > 30)
    return { score: 10, label: `Rain in ~${minutesToRain} min` };
  return { score: 10, label: "Rain expected soon" };
}

function scoreTide(tides: { type: "high" | "low"; time: string; height: number }[]): { bonus: number; label: string } {
  if (!tides || tides.length === 0) return { bonus: 0, label: "No tide data" };
  const now = Date.now();
  // Find the two tides bracketing now (last past + next future)
  const past = [...tides].reverse().find((t) => new Date(t.time).getTime() <= now);
  const next = tides.find((t) => new Date(t.time).getTime() > now);
  if (!past || !next) return { bonus: 0, label: "" };

  const totalSpan = new Date(next.time).getTime() - new Date(past.time).getTime();
  const elapsed = now - new Date(past.time).getTime();
  const progress = totalSpan > 0 ? elapsed / totalSpan : 0.5;

  // If we're near high tide (past=high, progress<0.3 OR next=high, progress>0.7) → bonus
  // If we're near low tide → penalty
  if (past.type === "high" && progress < 0.35) return { bonus: 10, label: "Near high tide" };
  if (next.type === "high" && progress > 0.65) return { bonus: 10, label: "High tide approaching" };
  if (past.type === "high" && progress < 0.55) return { bonus: 5, label: "Tide going out" };
  if (next.type === "high" && progress > 0.45) return { bonus: 5, label: "Tide coming in" };
  if (past.type === "low" && progress < 0.35) return { bonus: -5, label: "Near low tide" };
  return { bonus: 0, label: "Mid-tide" };
}

function scoreWaves(height: number): { score: number; label: string } {
  if (height < 0.3) return { score: 25, label: `${height.toFixed(1)}m — calm` };
  if (height < 0.6) return { score: 18, label: `${height.toFixed(1)}m — moderate` };
  if (height < 1.0) return { score: 8, label: `${height.toFixed(1)}m — choppy` };
  return { score: 0, label: `${height.toFixed(1)}m — rough` };
}

interface Verdict {
  text: string;
  bg: string;
  border: string;
  textColor: string;
  subTextColor: string;
  emoji: string;
}

function getVerdict(score: number): Verdict {
  if (score >= 80)
    return {
      text: "Perfect for a swim!",
      bg: "bg-emerald-50/80 dark:bg-emerald-950/30",
      border: "border-emerald-200/60 dark:border-emerald-800/40",
      textColor: "text-emerald-800 dark:text-emerald-200",
      subTextColor: "text-emerald-700/70 dark:text-emerald-300/60",
      emoji: "🏊",
    };
  if (score >= 60)
    return {
      text: "Good conditions",
      bg: "bg-green-50/80 dark:bg-green-950/25",
      border: "border-green-200/60 dark:border-green-800/40",
      textColor: "text-green-800 dark:text-green-200",
      subTextColor: "text-green-700/70 dark:text-green-300/60",
      emoji: "👍",
    };
  if (score >= 40)
    return {
      text: "Possible, but check conditions",
      bg: "bg-amber-50/80 dark:bg-amber-950/25",
      border: "border-amber-200/60 dark:border-amber-700/40",
      textColor: "text-amber-800 dark:text-amber-200",
      subTextColor: "text-amber-700/70 dark:text-amber-300/60",
      emoji: "🤔",
    };
  if (score >= 20)
    return {
      text: "Not ideal today",
      bg: "bg-orange-50/80 dark:bg-orange-950/25",
      border: "border-orange-200/60 dark:border-orange-800/40",
      textColor: "text-orange-800 dark:text-orange-200",
      subTextColor: "text-orange-700/70 dark:text-orange-300/60",
      emoji: "😬",
    };
  return {
    text: "Best to stay dry",
    bg: "bg-red-50/80 dark:bg-red-950/25",
    border: "border-red-200/60 dark:border-red-800/40",
    textColor: "text-red-800 dark:text-red-200",
    subTextColor: "text-red-700/70 dark:text-red-300/60",
    emoji: "🌊",
  };
}

// --- Component ---

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
  const _forecast = forecastData?.data;

  // Need at least current conditions to show anything useful
  if (!current) {
    return (
      <div className="animate-pulse">
        <div className="h-40 card bg-ocean-100/50 dark:bg-white/[0.04]" />
      </div>
    );
  }

  // Build scores from what's available
  const windResult = scoreWind(current.windSpeed);

  const rainResult = rain
    ? scoreRain(current.rainRate, rain.rainExpected, rain.minutesToRain)
    : current.rainRate > 0
      ? { score: 0, label: "Currently raining" }
      : { score: 20, label: "No rain data" };

  const seaTempResult = sea ? scoreSeaTemp(sea.seaTemp) : null;
  const waveResult = sea ? scoreWaves(sea.waveHeight) : null;

  // Tide bonus (high tide preferred at the Forty Foot)
  const tideResult = sea?.tides ? scoreTide(sea.tides) : null;

  // Calculate total — scale to 100 even if sea data is missing
  let totalScore: number;
  if (seaTempResult && waveResult) {
    totalScore = windResult.score + rainResult.score + seaTempResult.score + waveResult.score;
    if (tideResult) totalScore = Math.min(100, Math.max(0, totalScore + tideResult.bonus));
  } else {
    // Only wind + rain available (max 50) — scale to 100
    const partial = windResult.score + rainResult.score;
    totalScore = Math.round((partial / 50) * 100);
  }

  const verdict = getVerdict(totalScore);

  const breakdownItems: { emoji: string; label: string; detail: string }[] = [];

  if (seaTempResult) {
    breakdownItems.push({
      emoji: "🌡️",
      label: "Sea temp",
      detail: seaTempResult.label,
    });
  }

  breakdownItems.push({
    emoji: "💨",
    label: "Wind",
    detail: windResult.label,
  });

  breakdownItems.push({
    emoji: current.rainRate > 0 ? "🌧️" : "☀️",
    label: "Rain",
    detail: rainResult.label,
  });

  if (waveResult) {
    breakdownItems.push({
      emoji: "🌊",
      label: "Waves",
      detail: waveResult.label,
    });
  }

  // Tide state
  if (sea?.tides && sea.tides.length > 0) {
    const tideLabel = tideResult?.label || "Mid-tide";
    const now = Date.now();
    const nextTide = sea.tides.find((t) => new Date(t.time).getTime() > now);
    const tideDetail = nextTide
      ? `${tideLabel} · Next ${nextTide.type === "high" ? "high" : "low"} at ${new Date(nextTide.time).toLocaleTimeString("en-IE", { timeZone: "Europe/Dublin", hour: "2-digit", minute: "2-digit" })}`
      : tideLabel;
    const tideEmoji = tideLabel.includes("high") || tideLabel.includes("High")
      ? "⬆️"
      : tideLabel.includes("low") || tideLabel.includes("Low")
        ? "⬇️"
        : tideLabel.includes("coming") || tideLabel.includes("approaching")
          ? "↗️"
          : tideLabel.includes("going") || tideLabel.includes("out")
            ? "↘️"
            : "🌊";
    breakdownItems.push({
      emoji: tideEmoji,
      label: "Tide",
      detail: tideDetail,
    });
  }

  return (
    <div
      className={`rounded-2xl border p-5 transition-colors duration-300 ${verdict.bg} ${verdict.border}`}
    >
      {/* Verdict heading */}
      <div className="flex items-center gap-3 mb-4">
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

      {/* Breakdown grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {breakdownItems.map((item) => (
          <div
            key={item.label}
            className="flex items-start gap-2 rounded-xl bg-white/40 dark:bg-white/[0.06] px-3 py-2.5"
          >
            <span className="text-base mt-0.5 shrink-0" role="img" aria-hidden="true">
              {item.emoji}
            </span>
            <div className="min-w-0">
              <div className="text-[11px] font-medium uppercase tracking-wider text-gray-500/80 dark:text-gray-400/60">
                {item.label}
              </div>
              <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                {item.detail}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
