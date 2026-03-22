import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { ApiResponse, Observation } from "@/lib/types";

function formatHour(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IE", {
    timeZone: "Europe/Dublin",
    hour: "2-digit",
    hour12: false,
  }).replace(/:00$/, "");
}

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

export default function TodayCharts() {
  const { data, isLoading, error } = useQuery<ApiResponse<Observation[]>>({
    queryKey: ["today"],
    queryFn: () => fetch("/api/today").then((r) => r.json()),
    refetchInterval: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="animate-pulse grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[268px] card bg-ocean-100/50 dark:bg-white/[0.04]" />
        ))}
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
        Failed to load today's observations.
        {data?.isStale && " Showing last known data."}
      </div>
    );
  }

  const observations = data.data;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Temperature */}
      <ChartCard title="Temperature">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={observations}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatHour}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              label={{
                value: "°C",
                position: "insideLeft",
                offset: 0,
                style: { fontSize: 12 },
              }}
            />
            <Tooltip
              labelFormatter={formatHour}
              formatter={(value: number) => [`${value.toFixed(1)} °C`, "Temp"]}
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
          <LineChart data={observations}>
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
          <BarChart data={observations}>
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
          <LineChart data={observations}>
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
  );
}
