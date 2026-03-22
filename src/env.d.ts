/// <reference types="astro/client" />

declare module "cloudflare:workers" {
  interface Env {
    WEATHER_CACHE: KVNamespace;
    WEATHER_DB: D1Database;
    WU_API_KEY: string;
    STATION_ID: string;
    LATITUDE: string;
    LONGITUDE: string;
    ASSETS: Fetcher;
  }
  const env: Env;
  export { env };
  export type { Env };
}
