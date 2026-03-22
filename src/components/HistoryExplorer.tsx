import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { ApiResponse, Observation, DailySummary } from "@/lib/types";

type Mode = "day" | "range";

/* ── helpers ─────────────────────────────────────────────────────── */

function toYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function toInputDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function inputToYYYYMMDD(s: string): string {
  return s.replace(/-/g, "");
}

function formatHour(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IE", {
    timeZone: "Europe/Dublin",
    hour: "2-digit",
    hour12: false,
  }).replace(/:00$/, "");
}

function formatTimeFull(iso: string): string {
  return new Date(iso).toLocaleString("en-IE", {
    timeZone: "Europe/Dublin",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDate(date: string): string {
  // Handle both YYYYMMDD and YYYY-MM-DD formats
  const clean = date.replace(/-/g, "");
  const d = clean.slice(6, 8);
  const m = clean.slice(4, 6);
  return `${d}/${m}`;
}

function yesterday(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

/** Filter observations to most recent + one per hour for 24h (most recent first) */
function hourlySnapshot(observations: Observation[]): Observation[] {
  if (observations.length === 0) return [];
  const sorted = [...observations].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
  const mostRecent = sorted[0];
  const seen = new Set<string>();
  const hourly: Observation[] = [];

  for (const obs of sorted) {
    const hour = new Date(obs.timestamp).toLocaleString("en-IE", {
      timeZone: "Europe/Dublin",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
    });
    if (!seen.has(hour)) {
      seen.add(hour);
      hourly.push(obs);
    }
    if (hourly.length >= 25) break; // 24h + buffer
  }

  // Ensure most recent is first even if it shares an hour slot
  if (hourly[0]?.timestamp !== mostRecent.timestamp) {
    hourly.unshift(mostRecent);
  }
  return hourly;
}

/* ── shared UI pieces ────────────────────────────────────────────── */

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-4">
      <h3 className="stat-label mb-3">{title}</h3>
      {children}
    </div>
  );
}

function LoadingSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="animate-pulse grid grid-cols-1 sm:grid-cols-2 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-[268px] card bg-ocean-100/50 dark:bg-white/[0.04]" />
      ))}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
      {message}
    </div>
  );
}

/* ── Day View ────────────────────────────────────────────────────── */

function DayView() {
  const [dateInput, setDateInput] = useState(toInputDate(yesterday()));
  const dateKey = inputToYYYYMMDD(dateInput);

  const { data, isLoading, error } = useQuery<ApiResponse<Observation[]>>({
    queryKey: ["history", dateKey],
    queryFn: () => fetch(`/api/history/${dateKey}`).then((r) => r.json()),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="stat-label text-sm">Date:</label>
        <input
          type="date"
          value={dateInput}
          max={toInputDate(new Date())}
          onChange={(e) => setDateInput(e.target.value)}
          className="border border-ocean-200 dark:border-ocean-700 dark:bg-ocean-900 dark:text-gray-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ocean-500"
        />
      </div>

      {isLoading && <LoadingSkeleton count={4} />}

      {(error || (data && !data.data)) && (
        <ErrorBox message="Failed to load historical observations." />
      )}

      {data?.data && data.data.length === 0 && !isLoading && (
        <ErrorBox message="No observations found for this date." />
      )}

      {data?.data && data.data.length > 0 && (
        <>
          {/* Charts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Temperature */}
            <ChartCard title="Temperature">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={formatHour}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    label={{
                      value: "\u00b0C",
                      position: "insideLeft",
                      offset: 0,
                      style: { fontSize: 12 },
                    }}
                  />
                  <Tooltip
                    labelFormatter={formatHour}
                    formatter={(value: number) => [
                      `${value.toFixed(1)} \u00b0C`,
                      "Temp",
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="temperature"
                    stroke="#3b82f6"
                    dot={false}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Wind */}
            <ChartCard title="Wind">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={formatHour}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    label={{
                      value: "km/h",
                      position: "insideLeft",
                      offset: 0,
                      style: { fontSize: 12 },
                    }}
                  />
                  <Tooltip
                    labelFormatter={formatHour}
                    formatter={(value: number, name: string) => [
                      `${value.toFixed(1)} km/h`,
                      name === "windSpeed" ? "Speed" : "Gust",
                    ]}
                  />
                  <Legend
                    formatter={(value: string) =>
                      value === "windSpeed" ? "Speed" : "Gust"
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="windSpeed"
                    stroke="#14b8a6"
                    dot={false}
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="windGust"
                    stroke="#9ca3af"
                    dot={false}
                    strokeWidth={1.5}
                    strokeDasharray="5 3"
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Rainfall */}
            <ChartCard title="Rainfall">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={formatHour}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    label={{
                      value: "mm/h",
                      position: "insideLeft",
                      offset: 0,
                      style: { fontSize: 12 },
                    }}
                  />
                  <Tooltip
                    labelFormatter={formatHour}
                    formatter={(value: number) => [
                      `${value.toFixed(1)} mm/h`,
                      "Rain Rate",
                    ]}
                  />
                  <Bar dataKey="rainRate" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Pressure */}
            <ChartCard title="Pressure">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={formatHour}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    domain={["auto", "auto"]}
                    label={{
                      value: "hPa",
                      position: "insideLeft",
                      offset: 0,
                      style: { fontSize: 12 },
                    }}
                  />
                  <Tooltip
                    labelFormatter={formatHour}
                    formatter={(value: number) => [
                      `${value.toFixed(1)} hPa`,
                      "Pressure",
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="pressure"
                    stroke="#a855f7"
                    dot={false}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Data Table */}
          <div className="card p-4">
            <h3 className="stat-label mb-3">
              Observations
            </h3>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-ocean-600/70 dark:text-ocean-200/50 uppercase bg-ocean-50/80 dark:bg-white/[0.04] sticky top-0">
                  <tr>
                    <th className="px-3 py-2">Time</th>
                    <th className="px-3 py-2">Temp</th>
                    <th className="px-3 py-2">Humidity</th>
                    <th className="px-3 py-2">Wind</th>
                    <th className="px-3 py-2">Gust</th>
                    <th className="px-3 py-2">Direction</th>
                    <th className="px-3 py-2">Pressure</th>
                    <th className="px-3 py-2">Rain</th>
                    <th className="px-3 py-2">UV</th>
                  </tr>
                </thead>
                <tbody>
                  {hourlySnapshot(data.data).map((obs, i) => (
                    <tr
                      key={obs.timestamp}
                      className={i % 2 === 0 ? "bg-transparent" : "bg-ocean-50/50 dark:bg-white/[0.02]"}
                    >
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        {formatTimeFull(obs.timestamp)}
                      </td>
                      <td className="px-3 py-1.5">
                        {obs.temperature.toFixed(1)}&deg;C
                      </td>
                      <td className="px-3 py-1.5">{obs.humidity}%</td>
                      <td className="px-3 py-1.5">
                        {obs.windSpeed.toFixed(1)} km/h
                      </td>
                      <td className="px-3 py-1.5">
                        {obs.windGust.toFixed(1)} km/h
                      </td>
                      <td className="px-3 py-1.5">{obs.windDirection}&deg;</td>
                      <td className="px-3 py-1.5">
                        {obs.pressure.toFixed(1)} hPa
                      </td>
                      <td className="px-3 py-1.5">
                        {obs.rainRate.toFixed(1)} mm/h
                      </td>
                      <td className="px-3 py-1.5">{obs.uv}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Range View ──────────────────────────────────────────────────── */

function RangeView() {
  const [startInput, setStartInput] = useState(toInputDate(daysAgo(7)));
  const [endInput, setEndInput] = useState(toInputDate(yesterday()));

  const startKey = inputToYYYYMMDD(startInput);
  const endKey = inputToYYYYMMDD(endInput);

  const { data, isLoading, error } = useQuery<ApiResponse<DailySummary[]>>({
    queryKey: ["history-range", startKey, endKey],
    queryFn: () =>
      fetch(`/api/history-range?start=${startKey}&end=${endKey}`).then((r) =>
        r.json(),
      ),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="stat-label text-sm">Start:</label>
        <input
          type="date"
          value={startInput}
          max={toInputDate(new Date())}
          onChange={(e) => setStartInput(e.target.value)}
          className="border border-ocean-200 dark:border-ocean-700 dark:bg-ocean-900 dark:text-gray-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ocean-500"
        />
        <label className="stat-label text-sm">End:</label>
        <input
          type="date"
          value={endInput}
          max={toInputDate(new Date())}
          onChange={(e) => setEndInput(e.target.value)}
          className="border border-ocean-200 dark:border-ocean-700 dark:bg-ocean-900 dark:text-gray-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ocean-500"
        />
      </div>

      {isLoading && <LoadingSkeleton count={3} />}

      {(error || (data && !data.data)) && (
        <ErrorBox message="Failed to load historical range data." />
      )}

      {data?.data && data.data.length === 0 && !isLoading && (
        <ErrorBox message="No data found for this date range. Try a shorter or more recent range." />
      )}

      {data?.data && data.data.length > 0 && (
        <>
          {/* Charts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Temperature Range */}
            <ChartCard title="Temperature Range">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    label={{
                      value: "\u00b0C",
                      position: "insideLeft",
                      offset: 0,
                      style: { fontSize: 12 },
                    }}
                  />
                  <Tooltip
                    labelFormatter={formatDate}
                    formatter={(value: number, name: string) => {
                      const labels: Record<string, string> = {
                        tempHigh: "High",
                        tempLow: "Low",
                        tempAvg: "Avg",
                      };
                      return [
                        `${value.toFixed(1)} \u00b0C`,
                        labels[name] ?? name,
                      ];
                    }}
                  />
                  <Legend
                    formatter={(value: string) => {
                      const labels: Record<string, string> = {
                        tempHigh: "High",
                        tempLow: "Low",
                        tempAvg: "Avg",
                      };
                      return labels[value] ?? value;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="tempHigh"
                    stroke="#ef4444"
                    fill="#fecaca"
                    strokeWidth={1.5}
                  />
                  <Area
                    type="monotone"
                    dataKey="tempLow"
                    stroke="#3b82f6"
                    fill="#dbeafe"
                    strokeWidth={1.5}
                  />
                  <Line
                    type="monotone"
                    dataKey="tempAvg"
                    stroke="#f59e0b"
                    dot={false}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Rain Total */}
            <ChartCard title="Rain Total">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    label={{
                      value: "mm",
                      position: "insideLeft",
                      offset: 0,
                      style: { fontSize: 12 },
                    }}
                  />
                  <Tooltip
                    labelFormatter={formatDate}
                    formatter={(value: number) => [
                      `${value.toFixed(1)} mm`,
                      "Rain",
                    ]}
                  />
                  <Bar dataKey="rainTotal" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Wind Max */}
            <ChartCard title="Wind Max">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    label={{
                      value: "km/h",
                      position: "insideLeft",
                      offset: 0,
                      style: { fontSize: 12 },
                    }}
                  />
                  <Tooltip
                    labelFormatter={formatDate}
                    formatter={(value: number, name: string) => [
                      `${value.toFixed(1)} km/h`,
                      name === "windMax" ? "Wind Max" : "Gust Max",
                    ]}
                  />
                  <Legend
                    formatter={(value: string) =>
                      value === "windMax" ? "Wind Max" : "Gust Max"
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="windMax"
                    stroke="#14b8a6"
                    dot={false}
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="gustMax"
                    stroke="#9ca3af"
                    dot={false}
                    strokeWidth={1.5}
                    strokeDasharray="5 3"
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Summary Table */}
          <div className="card p-4">
            <h3 className="stat-label mb-3">
              Daily Summaries
            </h3>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-ocean-600/70 dark:text-ocean-200/50 uppercase bg-ocean-50/80 dark:bg-white/[0.04] sticky top-0">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">High</th>
                    <th className="px-3 py-2">Low</th>
                    <th className="px-3 py-2">Avg</th>
                    <th className="px-3 py-2">Humidity</th>
                    <th className="px-3 py-2">Wind Max</th>
                    <th className="px-3 py-2">Gust Max</th>
                    <th className="px-3 py-2">Rain</th>
                    <th className="px-3 py-2">Pressure</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((row, i) => (
                    <tr
                      key={row.date}
                      className={i % 2 === 0 ? "bg-transparent" : "bg-ocean-50/50 dark:bg-white/[0.02]"}
                    >
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        {formatDate(row.date)}
                      </td>
                      <td className="px-3 py-1.5">
                        {row.tempHigh.toFixed(1)}&deg;C
                      </td>
                      <td className="px-3 py-1.5">
                        {row.tempLow.toFixed(1)}&deg;C
                      </td>
                      <td className="px-3 py-1.5">
                        {row.tempAvg.toFixed(1)}&deg;C
                      </td>
                      <td className="px-3 py-1.5">
                        {row.humidityAvg.toFixed(0)}%
                      </td>
                      <td className="px-3 py-1.5">
                        {row.windMax.toFixed(1)} km/h
                      </td>
                      <td className="px-3 py-1.5">
                        {row.gustMax.toFixed(1)} km/h
                      </td>
                      <td className="px-3 py-1.5">
                        {row.rainTotal.toFixed(1)} mm
                      </td>
                      <td className="px-3 py-1.5">
                        {row.pressureAvg.toFixed(1)} hPa
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Main Export ──────────────────────────────────────────────────── */

export default function HistoryExplorer() {
  const [mode, setMode] = useState<Mode>("day");

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode("day")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === "day"
              ? "bg-ocean-600 text-white"
              : "bg-ocean-100 dark:bg-ocean-800 text-ocean-700 dark:text-ocean-200 hover:bg-ocean-200 dark:hover:bg-ocean-700"
          }`}
        >
          Single Day
        </button>
        <button
          onClick={() => setMode("range")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === "range"
              ? "bg-ocean-600 text-white"
              : "bg-ocean-100 dark:bg-ocean-800 text-ocean-700 dark:text-ocean-200 hover:bg-ocean-200 dark:hover:bg-ocean-700"
          }`}
        >
          Date Range
        </button>
      </div>

      {mode === "day" ? <DayView /> : <RangeView />}
    </div>
  );
}
