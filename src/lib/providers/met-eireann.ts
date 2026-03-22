/** Met Éireann warnings provider */

import type { Warning } from "@/lib/types";

const WARNINGS_URL =
  "https://www.met.ie/Open_Data/json/warning_IRELAND.json";

/** Dublin-relevant region keywords */
const DUBLIN_REGIONS = [
  "dublin",
  "leinster",
  "ireland",
  "all counties",
  "nationwide",
];

interface MEWarningRaw {
  id?: string;
  capId?: string;
  type?: string;
  severity?: string;
  level?: string;
  headline?: string;
  description?: string;
  regions?: string[];
  region?: string[];
  onset?: string;
  expiry?: string;
  updated?: string;
  status?: string;
}

function normalizeLevel(raw: MEWarningRaw): Warning["level"] {
  const s = (raw.severity ?? raw.level ?? "").toLowerCase();
  if (s.includes("red")) return "red";
  if (s.includes("orange")) return "orange";
  return "yellow";
}

function isDublinRelevant(raw: MEWarningRaw): boolean {
  const regions = raw.regions ?? raw.region ?? [];
  if (regions.length === 0) return true; // nationwide if no regions specified
  return regions.some((r) =>
    DUBLIN_REGIONS.some((d) => r.toLowerCase().includes(d)),
  );
}

function isActive(raw: MEWarningRaw): boolean {
  if (!raw.expiry) return true;
  return new Date(raw.expiry).getTime() > Date.now();
}

function normalizeWarning(raw: MEWarningRaw): Warning {
  return {
    id: raw.id ?? raw.capId ?? crypto.randomUUID(),
    level: normalizeLevel(raw),
    type: raw.type ?? "Weather",
    headline: raw.headline ?? "Weather Warning",
    description: raw.description ?? "",
    regions: raw.regions ?? raw.region ?? [],
    onset: raw.onset ?? new Date().toISOString(),
    expiry: raw.expiry ?? "",
    source: "met-eireann",
  };
}

export async function fetchWarnings(): Promise<Warning[]> {
  const res = await fetch(WARNINGS_URL, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Met Éireann warnings failed: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();

  // The response may be an array directly or wrapped in an object
  const rawWarnings: MEWarningRaw[] = Array.isArray(json)
    ? json
    : (json.warnings ?? json.data ?? []);

  return rawWarnings
    .filter(isActive)
    .filter(isDublinRelevant)
    .map(normalizeWarning);
}
