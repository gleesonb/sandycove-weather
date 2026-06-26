import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

/**
 * Map camera IDs to their ipcamlive player aliases and a fallback server prefix.
 * ipcamlive rebalances streams across servers (e.g. s121 -> s44) and rotates
 * stream IDs over time, so both the server and stream ID are resolved
 * dynamically from the player page below. The `server` here is only a
 * last-resort fallback used when the player page can't be parsed.
 */
const CAMERAS: Record<string, { alias: string; server: string }> = {
  "east-pier": { alias: "5d933014c3f12", server: "s44" },
  anchorage: { alias: "628cab8ec5e2c", server: "s21" },
};

const STREAM_CACHE_TTL = 3600; // Cache resolved stream (id + server) for 1 hour

interface Stream {
  streamId: string;
  server: string;
}

/** Fetch the ipcamlive player page and extract the current stream ID and server. */
async function resolveStream(
  alias: string,
  fallbackServer: string,
): Promise<Stream | null> {
  try {
    const res = await fetch(
      `https://g0.ipcamlive.com/player/player.php?alias=${alias}`,
    );
    if (!res.ok) return null;
    const html = await res.text();
    const streamId = html.match(/streamid\s*=\s*'([^']+)'/)?.[1];
    if (!streamId) return null;
    const server =
      html.match(/var\s+address\s*=\s*'https?:\/\/(s\d+)\.ipcamlive\.com/)?.[1] ||
      fallbackServer;
    return { streamId, server };
  } catch {
    return null;
  }
}

/** Fetch snapshot from ipcamlive, trying cached then freshly resolved streams. */
async function fetchSnapshot(
  cameraId: string,
): Promise<Response | null> {
  const camera = CAMERAS[cameraId];
  if (!camera) return null;

  const kv = env.WEATHER_CACHE;

  // Build candidate streams: cached first, then a fresh resolve.
  const candidates: Stream[] = [];
  const cached = await kv.get(`webcam:stream:${cameraId}`);
  if (cached) {
    try {
      candidates.push(JSON.parse(cached) as Stream);
    } catch {
      // Ignore malformed cache entries.
    }
  }
  const fresh = await resolveStream(camera.alias, camera.server);
  if (
    fresh &&
    !candidates.some(
      (c) => c.streamId === fresh.streamId && c.server === fresh.server,
    )
  ) {
    candidates.push(fresh);
  }

  for (const { streamId, server } of candidates) {
    const snapshotUrl = `https://${server}.ipcamlive.com/streams/${streamId}/snapshot.jpg`;
    try {
      const res = await fetch(snapshotUrl);
      if (res.ok) {
        // Cache the working stream (id + server).
        await kv.put(
          `webcam:stream:${cameraId}`,
          JSON.stringify({ streamId, server }),
          { expirationTtl: STREAM_CACHE_TTL },
        );
        return res;
      }
    } catch {
      // Try next candidate.
    }
  }

  return null;
}

export const GET: APIRoute = async ({ params }) => {
  const cameraId = params.id;
  if (!cameraId || !CAMERAS[cameraId]) {
    return new Response(JSON.stringify({ error: "Unknown camera" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const snapshot = await fetchSnapshot(cameraId);

  if (!snapshot) {
    return new Response(JSON.stringify({ error: "Camera offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Proxy the snapshot image
  const body = await snapshot.arrayBuffer();
  return new Response(body, {
    headers: {
      "Content-Type": snapshot.headers.get("Content-Type") || "image/jpeg",
      "Cache-Control": "public, max-age=15",
      "Access-Control-Allow-Origin": "*",
    },
  });
};
