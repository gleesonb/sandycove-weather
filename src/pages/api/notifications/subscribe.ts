import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { apiResponse, errorResponse } from "@/lib/response";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { endpoint, keys } = body as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return errorResponse("Missing required fields: endpoint, keys.p256dh, keys.auth", 400);
    }

    await env.WEATHER_DB.prepare(
      "INSERT OR REPLACE INTO push_subscriptions (endpoint, p256dh, auth) VALUES (?, ?, ?)",
    )
      .bind(endpoint, keys.p256dh, keys.auth)
      .run();

    return apiResponse({ subscribed: true }, "push-notifications");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(`Failed to store subscription: ${message}`);
  }
};
