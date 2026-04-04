import { useQuery } from "@tanstack/react-query";
import type { ApiResponse, SeaConditions } from "@/lib/types";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface TidePoint {
  time: string;
  height: number;
  label?: string;
  type?: "high" | "low";
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString("en-IE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Dublin",
  });
}

function formatDate(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString("en-IE", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "Europe/Dublin",
  });
}

export default function TideGraph() {
  const { data, isLoading } = useQuery<ApiResponse<SeaConditions>>({
    queryKey: ["sea"],
    queryFn: () => fetch("/api/sea").then((r) => r.json()),
    refetchInterval: 30 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="card p-4 animate-pulse">
        <div className="h-40 bg-ocean-100/50 dark:bg-white/[0.04] rounded" />
      </div>
    );
  }

  if (!data?.data?.tides || data.data.tides.length === 0) {
    return (
      <div className="card p-4 text-sm text-gray-500 dark:text-gray-400">
        No tide data available
      </div>
    );
  }

  const tides = data.data.tides;

  // Create a smooth curve by interpolating between tide points
  const points: TidePoint[] = [];

  // Sort tides by time
  const sortedTides = [...tides].sort((a, b) =>
    new Date(a.time).getTime() - new Date(b.time).getTime()
  );

  // Get today's date range
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 2); // Show today + tomorrow

  // Generate points every 30 minutes
  for (let time = todayStart.getTime(); time <= todayEnd.getTime(); time += 30 * 60 * 1000) {
    const pointTime = new Date(time);

    // Find surrounding tides
    const prevTide = [...sortedTides].reverse().find((t) => new Date(t.time).getTime() <= time);
    const nextTide = sortedTides.find((t) => new Date(t.time).getTime() > time);

    let height = 0;
    let label: string | undefined;
    let type: "high" | "low" | undefined;

    if (prevTide && nextTide) {
      // Interpolate
      const prevTime = new Date(prevTide.time).getTime();
      const nextTime = new Date(nextTide.time).getTime();
      const progress = (time - prevTime) / (nextTime - prevTime);

      // Use sine curve for smooth tide transition
      const sineValue = Math.sin(progress * Math.PI);
      height = prevTide.height + (nextTide.height - prevTide.height) * sineValue;

      // Mark tide points
      if (progress < 0.05) {
        label = formatTime(prevTide.time);
        type = prevTide.type;
      }
    } else if (prevTide) {
      height = prevTide.height;
    }

    points.push({
      time: pointTime.toISOString(),
      height: Math.round(height * 10) / 10,
      label,
      type,
    });
  }

  // Find high and low points for reference lines
  const maxHeight = Math.max(...points.map((p) => p.height));
  const minHeight = Math.min(...points.map((p) => p.height));

  // Format for X-axis
  const tickFormatter = (timestamp: string) => {
    const date = new Date(timestamp);
    const hours = date.getHours();
    if (hours === 0 || hours % 6 === 0) {
      return date.toLocaleDateString("en-IE", {
        hour: "2-digit",
        hour12: false,
        timeZone: "Europe/Dublin",
      });
    }
    return "";
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="card bg-white/95 dark:bg-gray-800/95 p-3 shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {formatTime(data.time)}
          </div>
          <div className="text-lg font-semibold text-ocean-700 dark:text-ocean-300">
            {data.height.toFixed(1)}m
          </div>
          {data.type && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {data.type === "high" ? "🔼 High tide" : "🔽 Low tide"}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-3">
      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Tide Level Curve
          </h4>
          <div className="flex gap-3 text-xs text-gray-500 dark:text-gray-400">
            <span>🔼 High: {maxHeight.toFixed(1)}m</span>
            <span>🔽 Low: {minHeight.toFixed(1)}m</span>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={points} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <defs>
              <linearGradient id="tideGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="currentColor" stopOpacity={0.3} />
                <stop offset="95%" stopColor="currentColor" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              tickFormatter={tickFormatter}
              tick={{ fill: "currentColor", fontSize: 10 }}
              stroke="currentColor"
              className="text-gray-400 dark:text-gray-600"
              interval={6}
            />
            <YAxis
              domain={[minHeight - 0.5, maxHeight + 0.5]}
              tick={{ fill: "currentColor", fontSize: 10 }}
              stroke="currentColor"
              className="text-gray-400 dark:text-gray-600"
              width={35}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine
              y={0}
              stroke="currentColor"
              strokeOpacity={0.1}
              className="text-gray-400 dark:text-gray-600"
            />
            <Area
              type="monotone"
              dataKey="height"
              stroke="currentColor"
              className="text-ocean-600 dark:text-ocean-400"
              strokeWidth={2}
              fill="url(#tideGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* Tide markers */}
        <div className="flex gap-4 mt-3 text-xs">
          {sortedTides.slice(0, 4).map((tide) => (
            <div key={tide.time} className="flex items-center gap-1.5">
              <span>{tide.type === "high" ? "🔼" : "🔽"}</span>
              <span className="text-gray-600 dark:text-gray-400">
                {formatTime(tide.time)}
              </span>
              <span className="text-gray-500 dark:text-gray-500">
                {tide.height.toFixed(1)}m
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
