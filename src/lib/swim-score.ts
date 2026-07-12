/**
 * Single swim-conditions rubric shared by SwimIndicator (the "now" verdict)
 * and BestSwimTime (the best-hour picker).
 *
 * Scores UP from 0: five factors worth 0–20 each, summed and scaled to 0–100.
 * No base-of-100 saturation (the old bug that drowned the tide weighting and
 * made every calm dry hour tie at 100). Tide is a first-class factor so
 * high-tide hours genuinely outrank low-tide ones.
 */

import type {
  CurrentConditions,
  ForecastHour,
  RainAlarm,
  SeaConditions,
  TideEvent,
} from "@/lib/types";

// ─── Tide helpers ───────────────────────────────────────────────────────────

/** Cosine interpolation between tide points (same method as TideGraph). */
export function estimateTideHeight(
  tides: TideEvent[],
  timestamp: string | Date,
): number {
  if (tides.length === 0) return 1.5;
  if (tides.length === 1) return tides[0].height;

  const sorted = [...tides].sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
  );
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
  return prev?.height ?? next?.height ?? 1.5;
}

/** Normalize a tide height to 0 (today's low) .. 1 (today's high). */
function normalizeTide(tides: TideEvent[], height: number): number | null {
  if (tides.length < 2) return null;
  const heights = tides.map((t) => t.height);
  const min = Math.min(...heights);
  const max = Math.max(...heights);
  const range = max - min;
  if (range <= 0) return 0.5;
  return (height - min) / range;
}

// ─── Time helpers ───────────────────────────────────────────────────────────

/** Hour of day in Europe/Dublin (Workers run in UTC, so getHours() is wrong). */
export function dublinHour(timestamp: string | Date): number {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Dublin",
    hour: "2-digit",
    hour12: false,
  });
  // Intl can yield "24" at midnight; wrap to 0.
  return Number(fmt.format(new Date(timestamp))) % 24;
}

export function formatDublinTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString("en-IE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Dublin",
  });
}

const COMPASS_TO_DEG: Record<string, number> = {
  N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
  S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
};

export function compassToDegrees(dir: string): number | undefined {
  return COMPASS_TO_DEG[dir.toUpperCase()];
}

/**
 * Is the wind blowing off the bay toward the Forty Foot?
 * The bay opens to the N/NE/E of Sandycove, so wind FROM ~337.5–112.5°
 * (N→E→ESE) is onshore — choppy and colder. Offshore (over land) is sheltered.
 */
function isOnshore(degrees: number): boolean {
  const d = ((degrees % 360) + 360) % 360;
  return d >= 337.5 || d <= 112.5;
}

// ─── Factor scorers (each 0–20) ─────────────────────────────────────────────

export interface FactorResult {
  score: number; // 0..20
  label: string;
}

export function scoreWind(speedKmh: number, windDegrees?: number): FactorResult {
  let score: number;
  const r = Math.round(speedKmh);
  if (speedKmh < 15) score = 14;
  else if (speedKmh < 25) score = 10;
  else if (speedKmh < 35) score = 5;
  else score = 0;

  const band =
    speedKmh < 15 ? "calm" : speedKmh < 25 ? "breezy" : speedKmh < 35 ? "windy" : "stormy";

  // Onshore knock-off at the Forty Foot.
  if (windDegrees != null && isOnshore(windDegrees)) {
    score = Math.max(0, score - 4);
  }
  return { score, label: `${r} km/h — ${band}` };
}

/** Rain score for a forecast hour (precip mm + probability %). */
export function scoreRain(precipMm: number, probPct: number): FactorResult {
  if (precipMm > 0) return { score: 0, label: "Rain" };
  if (probPct < 20) return { score: 20, label: "Dry skies" };
  if (probPct < 50) return { score: 12, label: `Rain ${Math.round(probPct)}%` };
  return { score: 0, label: `Rain ${Math.round(probPct)}%` };
}

/** Rain score for "now" using the live rain alarm + current rate. */
export function scoreRainNow(rainRate: number, rain?: RainAlarm): FactorResult {
  if (rainRate > 0) return { score: 0, label: "Raining now" };
  if (!rain) return { score: 16, label: "Dry" };
  if (!rain.rainExpected) return { score: 20, label: "Dry skies" };
  if (rain.minutesToRain != null && rain.minutesToRain > 60)
    return { score: 16, label: `Rain ~${rain.minutesToRain}m` };
  return { score: 4, label: "Rain soon" };
}

export function scoreSeaTemp(tempC: number): FactorResult {
  const t = tempC.toFixed(1);
  if (tempC >= 15) return { score: 20, label: `${t}°C — lovely` };
  if (tempC >= 12) return { score: 14, label: `${t}°C — fresh` };
  if (tempC >= 10) return { score: 9, label: `${t}°C — cool` };
  if (tempC >= 8) return { score: 4, label: `${t}°C — cold` };
  return { score: 1, label: `${t}°C — very cold` };
}

export function scoreWaves(heightM: number): FactorResult {
  const h = heightM.toFixed(1);
  if (heightM < 0.3) return { score: 20, label: `${h}m — calm` };
  if (heightM < 0.6) return { score: 16, label: `${h}m — gentle` };
  if (heightM < 1.0) return { score: 9, label: `${h}m — moderate` };
  if (heightM < 2.0) return { score: 3, label: `${h}m — choppy` };
  return { score: 0, label: `${h}m — rough` };
}

/**
 * Tide score: steep curve from low (~0) to high (20), because the Forty Foot
 * strongly favours high / slack-high water. Label includes direction.
 */
export function scoreTide(tides: TideEvent[], timestamp: string | Date): FactorResult {
  if (tides.length < 2) return { score: 10, label: "Tide n/a" };

  const height = estimateTideHeight(tides, timestamp);
  const normalized = normalizeTide(tides, height);
  if (normalized == null) return { score: 10, label: "Tide n/a" };

  const score = Math.max(0, Math.min(20, Math.round(Math.pow(normalized, 1.5) * 20)));

  // Rising or falling? Compare against an hour ahead.
  const t = new Date(timestamp).getTime();
  const ahead = estimateTideHeight(tides, new Date(t + 60 * 60 * 1000).toISOString());
  const rising = ahead >= height;

  let label: string;
  if (normalized >= 0.8) label = "High tide";
  else if (normalized <= 0.2) label = "Low tide";
  else label = rising ? "Tide coming in" : "Tide going out";

  return { score, label };
}

/** Forecast-only comfort proxy from feels-like air temp. */
function scoreComfort(feelsLikeC: number): FactorResult {
  const r = Math.round(feelsLikeC);
  if (feelsLikeC >= 18) return { score: 20, label: `${r}°C` };
  if (feelsLikeC >= 15) return { score: 15, label: `${r}°C` };
  if (feelsLikeC >= 12) return { score: 10, label: `${r}°C` };
  if (feelsLikeC >= 8) return { score: 4, label: `${r}°C — cool` };
  return { score: 1, label: `${r}°C — cold` };
}

/** Daylight by Europe/Dublin hour. */
function scoreDaylight(timestamp: string | Date): FactorResult {
  const h = dublinHour(timestamp);
  if (h >= 10 && h <= 17) return { score: 20, label: "Daylight" };
  if ((h >= 8 && h < 10) || (h > 17 && h <= 19)) return { score: 12, label: "Daylight" };
  if ((h >= 6 && h < 8) || (h > 19 && h <= 21)) return { score: 6, label: "Low sun" };
  return { score: 0, label: "After dark" };
}

// ─── Verdict bands ──────────────────────────────────────────────────────────

export interface Verdict {
  text: string;
  bg: string;
  border: string;
  textColor: string;
  subTextColor: string;
  emoji: string;
}

export function verdictBand(score: number): Verdict {
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

// ─── Display helpers ────────────────────────────────────────────────────────

function getUVInfo(uv: number): { emoji: string; label: string } {
  const r = uv.toFixed(0);
  if (uv <= 2) return { emoji: "☀️", label: `UV ${r} · Low` };
  if (uv <= 5) return { emoji: "🌤️", label: `UV ${r} · Mod` };
  if (uv <= 7) return { emoji: "⚠️", label: `UV ${r} · High` };
  if (uv <= 10) return { emoji: "🔴", label: `UV ${r} · V.High` };
  return { emoji: "🚨", label: `UV ${r} · Extreme` };
}

function tideEmoji(label: string): string {
  if (/high/i.test(label)) return "⬆️";
  if (/low/i.test(label)) return "⬇️";
  if (/coming|approaching/i.test(label)) return "↗️";
  if (/going|out/i.test(label)) return "↘️";
  return "🌊";
}

function seaSourceTag(source?: string): string {
  if (source === "dublin-bay-buoy") return "Dublin Bay Buoy";
  if (source === "open-meteo-marine") return "Open-Meteo";
  return "";
}

function nextTideDetail(label: string, tides: TideEvent[]): string {
  const now = Date.now();
  const next = tides.find((t) => new Date(t.time).getTime() > now);
  if (!next) return label;
  const time = new Date(next.time).toLocaleTimeString("en-IE", {
    timeZone: "Europe/Dublin",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${label} · Next ${next.type} ${time}`;
}

function scaleTo100(parts: { score: number; weight: number }[]): number {
  const maxScore = parts.reduce((s, p) => s + p.weight, 0);
  const raw = parts.reduce((s, p) => s + p.score, 0);
  return maxScore > 0 ? Math.round((raw / maxScore) * 100) : 0;
}

// ─── Compositions ───────────────────────────────────────────────────────────

export interface ScoreFactor {
  key: string;
  emoji: string;
  label: string;
  detail: string;
}

export interface NowScore {
  score: number;
  factors: ScoreFactor[];
  verdict: Verdict;
}

/** Score the current moment from live conditions. UV is display-only (not scored). */
export function scoreNow(opts: {
  current: CurrentConditions;
  sea?: SeaConditions;
  rain?: RainAlarm;
}): NowScore {
  const { current, sea, rain } = opts;

  const wind = scoreWind(current.windSpeed, current.windDegrees);
  const rainResult = scoreRainNow(current.rainRate, rain);
  const seaTemp = sea ? scoreSeaTemp(sea.seaTemp) : null;
  const waves = sea ? scoreWaves(sea.waveHeight) : null;
  const tide = sea?.tides?.length ? scoreTide(sea.tides, new Date()) : null;

  const parts = [
    { score: wind.score, weight: 20 },
    { score: rainResult.score, weight: 20 },
    ...(seaTemp ? [{ score: seaTemp.score, weight: 20 }] : []),
    ...(waves ? [{ score: waves.score, weight: 20 }] : []),
    ...(tide ? [{ score: tide.score, weight: 20 }] : []),
  ];
  const score = scaleTo100(parts);

  const factors: ScoreFactor[] = [];
  if (seaTemp) {
    const tag = seaSourceTag(sea?.seaTempSource);
    factors.push({
      key: "sea",
      emoji: "🌡️",
      label: "Sea temp",
      detail: tag ? `${seaTemp.label} · ${tag}` : seaTemp.label,
    });
  }
  factors.push({ key: "wind", emoji: "💨", label: "Wind", detail: wind.label });
  factors.push({
    key: "rain",
    emoji: current.rainRate > 0 ? "🌧️" : "☀️",
    label: "Rain",
    detail: rainResult.label,
  });
  const uv = getUVInfo(current.uv);
  factors.push({ key: "uv", emoji: uv.emoji, label: "UV index", detail: uv.label });
  if (waves) factors.push({ key: "waves", emoji: "🌊", label: "Waves", detail: waves.label });
  if (tide && sea?.tides?.length) {
    factors.push({
      key: "tide",
      emoji: tideEmoji(tide.label),
      label: "Tide",
      detail: nextTideDetail(tide.label, sea.tides),
    });
  }

  return { score, factors, verdict: verdictBand(score) };
}

export interface HourScore {
  hour: ForecastHour;
  score: number;
  reasons: string[];
  tideLabel?: string;
}

/** Score a forecast hour (no per-hour sea data; uses comfort + daylight instead). */
export function scoreHour(hour: ForecastHour, tides?: TideEvent[]): HourScore {
  const wind = scoreWind(hour.windSpeed, compassToDegrees(hour.windDirection));
  const rain = scoreRain(hour.precipitation, hour.precipProbability);
  const comfort = scoreComfort(hour.feelsLike);
  const daylight = scoreDaylight(hour.timestamp);
  const tide = tides && tides.length >= 2 ? scoreTide(tides, hour.timestamp) : null;

  const parts = [
    { score: wind.score, weight: 20 },
    { score: rain.score, weight: 20 },
    { score: comfort.score, weight: 20 },
    { score: daylight.score, weight: 20 },
    ...(tide ? [{ score: tide.score, weight: 20 }] : []),
  ];
  const score = scaleTo100(parts);

  const reasons: string[] = [];
  if (wind.score <= 5) reasons.push("Windy");
  if (rain.score === 0) reasons.push(hour.precipitation > 0 ? "Rain" : "Rain likely");
  if (comfort.score <= 4) reasons.push("Cool");
  if (daylight.score === 0) reasons.push("After dark");
  if (tide && /low/i.test(tide.label)) reasons.push("Low tide");
  if (reasons.length === 0) reasons.push("Great conditions");

  return { hour, score, reasons, tideLabel: tide?.label };
}

/** Top-N hours to swim from now to end of today (raw score desc, ties → earliest). */
export function findBestSwimTime(
  hourly: ForecastHour[],
  tides?: TideEvent[],
  limit = 3,
): HourScore[] {
  const now = new Date();
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  return hourly
    .filter((h) => {
      const t = new Date(h.timestamp);
      return t >= now && t <= todayEnd;
    })
    .map((h) => scoreHour(h, tides))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
