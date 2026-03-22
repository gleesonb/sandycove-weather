/** D1 database helpers for observations and daily summaries */

import type { Observation, DailySummary } from "./types";

/** Save an array of observations to D1 (upsert by station_id + timestamp) */
export async function saveObservations(
  db: D1Database,
  stationId: string,
  observations: Observation[],
): Promise<void> {
  if (observations.length === 0) return;

  const stmt = db.prepare(
    `INSERT OR REPLACE INTO observations
      (station_id, timestamp, temperature, humidity, wind_speed, wind_gust, wind_direction, pressure, rain_rate, rain_total, uv, solar_radiation)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const batch = observations.map((obs) =>
    stmt.bind(
      stationId,
      obs.timestamp,
      obs.temperature,
      obs.humidity,
      obs.windSpeed,
      obs.windGust,
      obs.windDirection,
      obs.pressure,
      obs.rainRate,
      obs.rainTotal,
      obs.uv,
      obs.solarRadiation,
    ),
  );

  await db.batch(batch);
}

/** Save a daily summary to D1 (upsert by station_id + date) */
export async function saveDailySummary(
  db: D1Database,
  stationId: string,
  summary: DailySummary,
): Promise<void> {
  await db
    .prepare(
      `INSERT OR REPLACE INTO daily_summaries
        (station_id, date, temp_high, temp_low, temp_avg, humidity_avg, wind_max, gust_max, rain_total, pressure_avg)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      stationId,
      summary.date,
      summary.tempHigh,
      summary.tempLow,
      summary.tempAvg,
      summary.humidityAvg,
      summary.windMax,
      summary.gustMax,
      summary.rainTotal,
      summary.pressureAvg,
    )
    .run();
}

/** Query observations for a specific date (YYYYMMDD) from D1 */
export async function getObservationsByDate(
  db: D1Database,
  stationId: string,
  date: string, // YYYYMMDD
): Promise<Observation[]> {
  // Convert YYYYMMDD to YYYY-MM-DD for timestamp prefix matching
  const dateStr = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;

  const result = await db
    .prepare(
      `SELECT timestamp, temperature, humidity, wind_speed, wind_gust, wind_direction, pressure, rain_rate, rain_total, uv, solar_radiation
      FROM observations
      WHERE station_id = ? AND timestamp >= ? AND timestamp < ?
      ORDER BY timestamp ASC`,
    )
    .bind(stationId, `${dateStr}T00:00:00`, `${dateStr}T23:59:60`)
    .all();

  return (result.results ?? []).map((row: Record<string, unknown>) => ({
    timestamp: row.timestamp as string,
    temperature: row.temperature as number,
    humidity: row.humidity as number,
    windSpeed: row.wind_speed as number,
    windGust: row.wind_gust as number,
    windDirection: row.wind_direction as number,
    pressure: row.pressure as number,
    rainRate: row.rain_rate as number,
    rainTotal: row.rain_total as number,
    uv: row.uv as number,
    solarRadiation: row.solar_radiation as number,
  }));
}

/** Query daily summaries by date range from D1 */
export async function getDailySummariesByRange(
  db: D1Database,
  stationId: string,
  startDate: string, // YYYYMMDD
  endDate: string, // YYYYMMDD
): Promise<DailySummary[]> {
  // Convert to YYYY-MM-DD for comparison
  const start = `${startDate.slice(0, 4)}-${startDate.slice(4, 6)}-${startDate.slice(6, 8)}`;
  const end = `${endDate.slice(0, 4)}-${endDate.slice(4, 6)}-${endDate.slice(6, 8)}`;

  const result = await db
    .prepare(
      `SELECT date, temp_high, temp_low, temp_avg, humidity_avg, wind_max, gust_max, rain_total, pressure_avg
      FROM daily_summaries
      WHERE station_id = ? AND date >= ? AND date <= ?
      ORDER BY date ASC`,
    )
    .bind(stationId, start, end)
    .all();

  return (result.results ?? []).map((row: Record<string, unknown>) => ({
    date: row.date as string,
    tempHigh: row.temp_high as number,
    tempLow: row.temp_low as number,
    tempAvg: row.temp_avg as number,
    humidityAvg: row.humidity_avg as number,
    windMax: row.wind_max as number,
    gustMax: row.gust_max as number,
    rainTotal: row.rain_total as number,
    pressureAvg: row.pressure_avg as number,
  }));
}

/** Compute a daily summary from an array of observations */
export function computeDailySummary(
  date: string, // YYYY-MM-DD
  observations: Observation[],
): DailySummary {
  if (observations.length === 0) {
    return {
      date,
      tempHigh: 0,
      tempLow: 0,
      tempAvg: 0,
      humidityAvg: 0,
      windMax: 0,
      gustMax: 0,
      rainTotal: 0,
      pressureAvg: 0,
    };
  }

  const temps = observations.map((o) => o.temperature);
  const humidities = observations.map((o) => o.humidity);
  const winds = observations.map((o) => o.windSpeed);
  const gusts = observations.map((o) => o.windGust);
  const pressures = observations.map((o) => o.pressure);

  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  const avg = (arr: number[]) => (arr.length > 0 ? sum(arr) / arr.length : 0);

  // Rain total: take the max rain_total value (cumulative) from observations
  const rainTotals = observations.map((o) => o.rainTotal);
  const maxRainTotal = Math.max(...rainTotals);

  return {
    date,
    tempHigh: Math.round(Math.max(...temps) * 10) / 10,
    tempLow: Math.round(Math.min(...temps) * 10) / 10,
    tempAvg: Math.round(avg(temps) * 10) / 10,
    humidityAvg: Math.round(avg(humidities) * 10) / 10,
    windMax: Math.round(Math.max(...winds) * 10) / 10,
    gustMax: Math.round(Math.max(...gusts) * 10) / 10,
    rainTotal: Math.round(maxRainTotal * 10) / 10,
    pressureAvg: Math.round(avg(pressures) * 10) / 10,
  };
}
