import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { ApiResponse } from "../lib/types";

interface TextForecastData {
  text: string;
  issued: string;
}

function LoadingSkeleton() {
  return (
    <div className="rounded-lg bg-white/80 p-5 shadow-sm animate-pulse">
      <div className="space-y-2">
        <div className="h-4 w-full rounded bg-gray-200" />
        <div className="h-4 w-5/6 rounded bg-gray-200" />
        <div className="h-4 w-4/6 rounded bg-gray-200" />
      </div>
      <div className="h-3 w-32 rounded bg-gray-200 mt-4" />
    </div>
  );
}

export default function TextForecast() {
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading, isError } = useQuery<
    ApiResponse<TextForecastData>
  >({
    queryKey: ["forecast-text"],
    queryFn: async () => {
      const res = await fetch("/api/forecast/text");
      if (!res.ok) throw new Error("Failed to fetch text forecast");
      return res.json();
    },
    refetchInterval: 60 * 60 * 1000,
  });

  if (isLoading) return <LoadingSkeleton />;
  if (isError || !data) {
    return (
      <p className="text-sm text-red-600">Unable to load text forecast.</p>
    );
  }

  const { text, issued } = data.data;
  const isLong = text.length > 200;
  const displayText = !expanded && isLong ? text.slice(0, 200) + "..." : text;

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
        Text Forecast
      </h3>
      <div className="rounded-lg bg-white/80 p-5 shadow-sm">
        <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
          {displayText}
        </div>
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium mt-2"
          >
            {expanded ? "Show less" : "Read more"}
          </button>
        )}
        <div className="text-xs text-gray-400 mt-3">
          Issued:{" "}
          {new Date(issued).toLocaleString("en-IE", {
            timeZone: "Europe/Dublin",
          })}
        </div>
      </div>
    </div>
  );
}
