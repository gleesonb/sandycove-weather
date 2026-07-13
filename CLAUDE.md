# CLAUDE.md — sandycove-weather

Production weather dashboard for Sandycove, Dublin (**[sandycove.app](https://sandycove.app)**). Astro 6 SSR + React 19 islands on Cloudflare Workers, with KV cache and D1 history. TypeScript throughout.

## Hard rules (full set in AGENTS.md)
- **Never delete files** without an exact, explicitly-approved command *in this session*. (AGENTS.md RULE 1 — absolute.)
- **Use bun** for all JS/TS (never npm/yarn/pnpm). Only `bun.lock` is allowed.
- Irreversible git/fs actions (`git reset --hard`, `rm -rf`, `git clean -fd`, …) are forbidden without explicit per-message approval.

## Architecture
- `src/pages/api/*` — edge API routes. Each follows **primary → fallback → stale-cache** (KV, served with `isStale: true`). Every response carries `source`, `fetchedAt`, `isStale`, `fallbackUsed`.
- `src/lib/providers/*` — one fetcher per upstream. `src/lib/cache.ts` (KV helpers), `src/lib/types.ts` (shared types + `CACHE_TTL`), `src/lib/response.ts`.
- `src/components/*` — React islands hydrated into Astro pages; TanStack Query for client fetches.
- Sources: Weather Underground (station IDNLAO16 — current/obs/history), OpenWeatherMap (forecast), Open-Meteo (forecast + rain fallback), Met Éireann (warnings), Marine Institute ERDDAP (tides), **Dublin Bay Buoy** (in-situ sea temp + waves), IPCamLive (webcams — scraped, fragile).

## Sea temp source
`src/lib/providers/sea.ts` prefers the **Dublin Bay Buoy** (`api.dublinbaybuoy.com`, publishable anon key stored in-file) for sea temp + waves; the **Open-Meteo marine model** is fallback (and still supplies wave direction). The model's Dublin cell runs ~4 °C hot (≈19.5 vs real ≈16.7), so the buoy is primary. The response `source` / `data.seaTempSource` field says which one won, and `SeaConditions.tsx` labels it. A buoy reading older than 3 h is treated as stale → fallback.

## Swim rubric
`src/lib/swim-score.ts` is the **single** scorer shared by `SwimIndicator` (the "now" verdict) and `BestSwimTime` (best-hour picker). Scores **up from 0** — five factors × 0–20 → 0–100. Tide is first-class (the Forty Foot favours high / slack-high water, so low tide scores near zero) and **wind direction matters** (onshore E/NE is penalised). Daylight uses Europe/Dublin hour, not UTC.
**Do not reintroduce base-100 + clamp scoring** — it saturates so every calm dry hour ties at 100 and the tide weighting stops mattering (this was the original bug). If the now-verdict and best-time ever drift apart, they should share one rubric.

## Testing
`vitest` with `@cloudflare/vitest-pool-workers` is currently **broken on Node ≥ 24 locally** (ESM config-load error: `@cloudflare/vitest-pool-workers` is ESM-only and the project has no `"type": "module"`), and **CI runs no test step**. To validate pure logic, write a throwaway `_scratch.ts` that imports the module and asserts, then `bun run _scratch.ts` (bun resolves the `@/*` tsconfig alias and runs TS natively). Committed `*.test.ts` files are correct and run under Node 22.

## Shipping
Push to `main` → `.github/workflows/deploy.yml` runs `bun run deploy`. **KV cache can mask a fresh deploy** — per-endpoint TTLs are 5–30 min, so a just-deployed worker can keep serving the previous code's cached values. Purge the key in the `WEATHER_CACHE` namespace to see changes live (e.g. `wrangler kv key delete sea --namespace-id=… --remote`). See memory `deploy-push-to-main`.

## Local dev gotchas
- `bun run dev` serves the app, but `/api/current` will **401** without `WEATHER_UNDERGROUND_KEY` in `.env`; other endpoints work fine.
- `sandycove.app` is wired via the Cloudflare **dashboard Custom Domains**, NOT wrangler routes — do not add it to `wrangler.deploy.toml` (it would conflict). See memory `domains-and-routing`.
