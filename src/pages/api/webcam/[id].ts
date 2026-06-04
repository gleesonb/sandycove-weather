import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

/** Map camera IDs to their ipcamlive player aliases and server prefixes */
const CAMERAS: Record<string, { alias: string; server: string }> = {
  "east-pier": { alias: "5d933014c3f12", server: "s121" },
  anchorage: { alias: "628cab8ec5e2c", server: "s21" },
};

const STREAM_ID_CACHE_TTL = 3600; // Cache stream ID resolution for 1 hour

/** Fetch the ipcamlive player page and extract the current stream ID */
async function resolveStreamId(
  alias: string,
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://g0.ipcamlive.com/player/player.php?alias=${alias}`,
    );
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/streamid\s*=\s*'([^']+)'/);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

/** Fetch snapshot from ipcamlive, trying current and previous stream IDs */
async function fetchSnapshot(
  cameraId: string,
): Promise<Response | null> {
  const camera = CAMERAS[cameraId];
  if (!camera) return null;

  const kv = env.WEATHER_CACHE;

  // Try cached stream ID first
  const cachedStreamId = await kv.get(`webcam:streamid:${cameraId}`);
  const server = camera.server;

  // Try all known stream IDs: cached, then fresh resolve
  const streamIds: string[] = [];
  if (cachedStreamId) streamIds.push(cachedStreamId);

  // Resolve fresh stream ID
  const freshStreamId = await resolveStreamId(camera.alias);
  if (freshStreamId && freshStreamId !== cachedStreamId) {
    streamIds.push(freshStreamId);
  }

  for (const streamId of streamIds) {
    if (!streamId) continue;
    const snapshotUrl = `https://${server}.ipcamlive.com/streams/${streamId}/snapshot.jpg`;
    try {
      const res = await fetch(snapshotUrl);
      if (res.ok) {
        // Cache the working stream ID
        await kv.put(`webcam:streamid:${cameraId}`, streamId, {
          expirationTtl: STREAM_ID_CACHE_TTL,
        });
        return res;
      }
    } catch {
      // Try next
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
