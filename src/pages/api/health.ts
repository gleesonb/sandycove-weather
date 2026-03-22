import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const GET: APIRoute = async () => {
  const checks: Record<string, { status: string; error?: string }> = {};

  // Check KV
  try {
    await env.WEATHER_CACHE.get("health-check");
    checks.kv = { status: "ok" };
  } catch (e) {
    checks.kv = {
      status: "error",
      error: e instanceof Error ? e.message : "KV unreachable",
    };
  }

  // Check D1
  try {
    await env.WEATHER_DB.prepare("SELECT 1").first();
    checks.d1 = { status: "ok" };
  } catch (e) {
    checks.d1 = {
      status: "error",
      error: e instanceof Error ? e.message : "D1 unreachable",
    };
  }

  // Check WU API key is set
  checks.wu_api_key = {
    status: env.WU_API_KEY ? "ok" : "error",
    ...(env.WU_API_KEY ? {} : { error: "WU_API_KEY not configured" }),
  };

  const allOk = Object.values(checks).every((c) => c.status === "ok");

  return new Response(
    JSON.stringify({
      status: allOk ? "ok" : "degraded",
      checks,
      timestamp: new Date().toISOString(),
    }),
    {
      status: allOk ? 200 : 503,
      headers: { "Content-Type": "application/json" },
    },
  );
};
