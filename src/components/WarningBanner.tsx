import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { ApiResponse, Warning } from "@/lib/types";

const LEVEL_STYLES: Record<Warning["level"], { bg: string; border: string; text: string }> = {
  yellow: { bg: "bg-[#fbbf24]", border: "border-yellow-500", text: "text-yellow-900" },
  orange: { bg: "bg-[#f97316]", border: "border-orange-600", text: "text-orange-950" },
  red: { bg: "bg-[#ef4444]", border: "border-red-600", text: "text-white" },
};

function formatDublinTime(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IE", {
    timeZone: "Europe/Dublin",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function WarningItem({ warning }: { warning: Warning }) {
  const [expanded, setExpanded] = useState(false);
  const styles = LEVEL_STYLES[warning.level];

  return (
    <div
      className={`${styles.bg} ${styles.border} ${styles.text} border rounded-lg overflow-hidden`}
    >
      <button
        className="w-full px-4 py-3 text-left flex items-center justify-between gap-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-lg flex-shrink-0" aria-hidden="true">
            {warning.level === "red" ? "🔴" : warning.level === "orange" ? "🟠" : "🟡"}
          </span>
          <div className="min-w-0">
            <div className="font-semibold truncate">{warning.headline}</div>
            <div className="text-sm opacity-80">
              {warning.type} — {formatDublinTime(warning.onset)}
              {warning.expiry && ` to ${formatDublinTime(warning.expiry)}`}
            </div>
          </div>
        </div>
        <span
          className="flex-shrink-0 text-sm transition-transform duration-200"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          ▼
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-3 text-sm opacity-90 border-t border-current/20 pt-3">
          {warning.description || "No additional details available."}
        </div>
      )}
    </div>
  );
}

export default function WarningBanner() {
  const { data } = useQuery<ApiResponse<Warning[]>>({
    queryKey: ["warnings"],
    queryFn: () => fetch("/api/warnings").then((r) => r.json()),
    refetchInterval: 10 * 60 * 1000,
  });

  const warnings = data?.data;
  if (!warnings || warnings.length === 0) return null;

  // Sort by severity: red first, then orange, then yellow
  const sorted = [...warnings].sort((a, b) => {
    const order = { red: 0, orange: 1, yellow: 2 };
    return order[a.level] - order[b.level];
  });

  return (
    <div className="space-y-2">
      {sorted.map((w) => (
        <WarningItem key={w.id} warning={w} />
      ))}
    </div>
  );
}
