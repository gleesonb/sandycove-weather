/**
 * Tests for the shared swim-conditions rubric (src/lib/swim-score.ts).
 *
 * Covers the behaviours the rewrite is meant to guarantee:
 *  - tide is a first-class factor (high > low), with no saturation defeating it
 *  - onshore wind is penalised at the Forty Foot
 *  - daylight is computed in Europe/Dublin, not UTC
 *  - findBestSwimTime prefers a high-tide daylight hour over a dead-low one
 *  - scoreNow verdict bands behave at the extremes
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  scoreWind,
  scoreSeaTemp,
  scoreTide,
  scoreHour,
  scoreNow,
  findBestSwimTime,
  dublinHour,
  compassToDegrees,
} from "@/lib/swim-score";
import type { CurrentConditions, ForecastHour, RainAlarm, SeaConditions, TideEvent } from "@/lib/types";

// Synthetic tide curve for 2026-07-12: low 03:00, high 09:00, low 15:00, high 21:00 (UTC).
const TIDES: TideEvent[] = [
  { type: "low", time: "2026-07-12T03:00:00Z", height: 1.0 },
  { type: "high", time: "2026-07-12T09:00:00Z", height: 4.0 },
  { type: "low", time: "2026-07-12T15:00:00Z", height: 1.0 },
  { type: "high", time: "2026-07-12T21:00:00Z", height: 4.0 },
];

function makeHour(timestamp: string, overrides: Partial<ForecastHour> = {}): ForecastHour {
  return {
    timestamp,
    temperature: 20,
    feelsLike: 20,
    humidity: 60,
    windSpeed: 5,
    windGust: 8,
    windDirection: "SW",
    precipitation: 0,
    precipProbability: 0,
    uv: 3,
    description: "",
    icon: "",
    ...overrides,
  };
}

function makeCurrent(overrides: Partial<CurrentConditions> = {}): CurrentConditions {
  return {
    temperature: 20,
    feelsLike: 20,
    humidity: 60,
    windSpeed: 5,
    windGust: 8,
    windDirection: "SW",
    windDegrees: 225,
    pressure: 1015,
    pressureTrend: "rising",
    rainRate: 0,
    rainTotal: 0,
    uv: 3,
    solarRadiation: 500,
    visibility: 20000,
    lastUpdated: "2026-07-12T09:00:00Z",
    stationOnline: true,
    ...overrides,
  };
}

const NO_RAIN: RainAlarm = { minutely: [], summary: "dry", rainExpected: false, minutesToRain: null };

describe("scoreWind", () => {
  it("penalises onshore wind (off the bay) at the Forty Foot", () => {
    const offshore = scoreWind(5, 225); // SW — over land, sheltered
    const onshore = scoreWind(5, 67.5); // ENE — off the bay
    expect(offshore.score).toBe(14); // calm band, no penalty
    expect(onshore.score).toBe(10); // 14 - 4 onshore knock-off
    expect(offshore.score).toBeGreaterThan(onshore.score);
  });

  it("scales down with speed", () => {
    expect(scoreWind(5).score).toBeGreaterThan(scoreWind(28).score);
    expect(scoreWind(40).score).toBe(0);
  });
});

describe("scoreSeaTemp", () => {
  it("rates realistic Dublin summer water at the top band", () => {
    const r = scoreSeaTemp(16.7); // the live buoy reading
    expect(r.score).toBe(20);
    expect(r.label).toContain("lovely");
  });

  it("scores winter water low", () => {
    expect(scoreSeaTemp(7).score).toBe(1);
  });
});

describe("scoreTide", () => {
  it("scores high tide well above low tide", () => {
    const high = scoreTide(TIDES, "2026-07-12T09:00:00Z");
    const low = scoreTide(TIDES, "2026-07-12T15:00:00Z");
    expect(high.score).toBe(20);
    expect(low.score).toBeLessThanOrEqual(1);
    expect(high.score).toBeGreaterThan(low.score);
  });

  it("labels direction (coming in / going out)", () => {
    const rising = scoreTide(TIDES, "2026-07-12T06:00:00Z"); // between low 03 and high 09
    const falling = scoreTide(TIDES, "2026-07-12T12:00:00Z"); // between high 09 and low 15
    expect(rising.label).toMatch(/coming in/i);
    expect(falling.label).toMatch(/going out/i);
  });
});

describe("dublinHour", () => {
  // Dublin is IST (UTC+1) in July.
  it("converts UTC to Europe/Dublin hour", () => {
    expect(dublinHour("2026-07-12T15:00:00Z")).toBe(16);
    expect(dublinHour("2026-07-12T11:00:00Z")).toBe(12);
  });
});

describe("compassToDegrees", () => {
  it("maps compass labels", () => {
    expect(compassToDegrees("N")).toBe(0);
    expect(compassToDegrees("ENE")).toBe(67.5);
    expect(compassToDegrees("SW")).toBe(225);
    expect(compassToDegrees("nope")).toBeUndefined();
  });
});

describe("scoreHour", () => {
  it("prefers a high-tide daylight hour over a low-tide one (all else equal)", () => {
    // 09:00Z = high tide, 10:00 IST (daylight). 15:00Z = low tide, 16:00 IST (daylight).
    const high = scoreHour(makeHour("2026-07-12T09:00:00Z"), TIDES);
    const low = scoreHour(makeHour("2026-07-12T15:00:00Z"), TIDES);
    expect(high.score).toBeGreaterThan(low.score);
    expect(low.reasons).toContain("Low tide");
  });
});

describe("findBestSwimTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-12T08:00:00Z")); // before today's hours
  });
  afterEach(() => vi.useRealTimers());

  it("ranks the high-tide daylight hour first and drops past hours", () => {
    const hourly = [
      makeHour("2026-07-12T06:00:00Z"), // past → filtered out
      makeHour("2026-07-12T09:00:00Z"), // high tide, daylight
      makeHour("2026-07-12T15:00:00Z"), // low tide, daylight
      makeHour("2026-07-12T21:00:00Z"), // high tide but dark (22:00 IST)
    ];
    const best = findBestSwimTime(hourly, TIDES);
    expect(best.length).toBe(3); // 06:00 filtered
    expect(best[0].hour.timestamp).toBe("2026-07-12T09:00:00Z");
  });
});

describe("scoreNow", () => {
  afterEach(() => vi.useRealTimers());

  it("returns 'Perfect for a swim!' on a calm, dry, warm, high-tide day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-12T09:00:00Z")); // high tide
    const sea: SeaConditions = {
      seaTemp: 16.7,
      waveHeight: 0.4,
      wavePeriod: 4,
      waveDirection: 90,
      tides: TIDES,
      seaTempSource: "dublin-bay-buoy",
      fetchedAt: "2026-07-12T09:00:00Z",
    };
    const result = scoreNow({
      current: makeCurrent({ windSpeed: 5, windDegrees: 225 }), // offshore calm
      sea,
      rain: NO_RAIN,
    });
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.verdict.text).toBe("Perfect for a swim!");
    // Sea temp factor carries the buoy attribution tag.
    const seaFactor = result.factors.find((f) => f.key === "sea");
    expect(seaFactor?.detail).toContain("Dublin Bay Buoy");
  });

  it("returns 'Best to stay dry' in a storm", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-12T15:00:00Z")); // low tide
    const sea: SeaConditions = {
      seaTemp: 7,
      waveHeight: 2.5,
      wavePeriod: 8,
      waveDirection: 90,
      tides: TIDES,
      seaTempSource: "dublin-bay-buoy",
      fetchedAt: "2026-07-12T15:00:00Z",
    };
    const result = scoreNow({
      current: makeCurrent({ windSpeed: 45, windDegrees: 67.5, rainRate: 0.5 }), // onshore storm + rain
      sea,
      rain: { ...NO_RAIN, rainExpected: true },
    });
    expect(result.score).toBeLessThan(20);
    expect(result.verdict.text).toBe("Best to stay dry");
  });
});
