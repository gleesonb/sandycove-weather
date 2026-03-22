import { useQuery } from "@tanstack/react-query";
import type { ApiResponse, RainAlarm as RainAlarmType } from "@/lib/types";

export default function RainAlarm() {
  const { data, isLoading, error } = useQuery<ApiResponse<RainAlarmType>>({
    queryKey: ["rain-alarm"],
    queryFn: async () => {
      const res = await fetch("/api/rain-alarm");
      if (!res.ok) throw new Error("Failed to fetch rain alarm");
      return res.json();
    },
    refetchInterval: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="rounded-xl bg-gray-100 dark:bg-gray-800 p-4 animate-pulse h-20" />
    );
  }

  if (error || !data?.data) return null;

  const alarm = data.data;
  const currentPrecip =
    alarm.minutely.length > 0 ? alarm.minutely[0].precipitation : 0;
  const isCurrentlyRaining = currentPrecip > 0;
  const isRainComing = !isCurrentlyRaining && alarm.rainExpected;

  // Take up to 24 bars (6 hours of 15-min intervals)
  const bars = alarm.minutely.slice(0, 24);
  const maxPrecip = Math.max(...bars.map((b) => b.precipitation), 1);

  return (
    <div
      className={`rounded-xl p-4 transition-colors ${
        isCurrentlyRaining
          ? "bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800"
          : isRainComing
            ? "bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800"
            : "bg-green-50 dark:bg-gray-800 border border-green-200 dark:border-gray-700"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">
            {isCurrentlyRaining || isRainComing ? "\u{1F327}\uFE0F" : "\u{1F324}\uFE0F"}
          </span>
          <span className="font-medium text-gray-800 dark:text-gray-200">
            {isCurrentlyRaining
              ? `Currently raining (${currentPrecip.toFixed(1)} mm/h)`
              : isRainComing
                ? `Rain expected in ~${alarm.minutesToRain} min`
                : "No rain expected in next 6 hours"}
          </span>
        </div>
      </div>

      {/* Mini precipitation bar chart */}
      <div className="flex items-end gap-px h-6">
        {bars.map((bar, i) => {
          const height =
            bar.precipitation > 0
              ? Math.max(2, (bar.precipitation / maxPrecip) * 24)
              : 0;
          const opacity =
            bar.precipitation > 0
              ? Math.max(0.2, Math.min(1, bar.precipitation / maxPrecip))
              : 0.05;
          return (
            <div
              key={i}
              className="w-[2px] rounded-t-sm"
              style={{
                height: bar.precipitation > 0 ? `${height}px` : "1px",
                backgroundColor:
                  bar.precipitation > 0
                    ? `rgba(59, 130, 246, ${opacity})`
                    : "rgba(156, 163, 175, 0.15)",
              }}
              title={`${new Date(bar.timestamp).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" })}: ${bar.precipitation.toFixed(1)} mm`}
            />
          );
        })}
      </div>
    </div>
  );
}
