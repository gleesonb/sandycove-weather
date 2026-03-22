import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { apiResponse, errorResponse } from "@/lib/response";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { endpoint } = body as { endpoint?: string };

    if (!endpoint) {
      return errorResponse("Missing required field: endpoint", 400);
    }

    await env.WEATHER_DB.prepare(
      "DELETE FROM push_subscriptions WHERE endpoint = ?",
    )
      .bind(endpoint)
      .run();

    return apiResponse({ unsubscribed: true }, "push-notifications");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(`Failed to remove subscription: ${message}`);
  }
};
