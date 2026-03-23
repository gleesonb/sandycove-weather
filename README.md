<div align="center">

# Sandycove Weather

### Live weather dashboard for Sandycove, Dublin, Ireland

**[weather.billgleeson.com](https://weather.billgleeson.com)**

[![Astro](https://img.shields.io/badge/Astro_6-FF5D01?logo=astro&logoColor=white)](https://astro.build)
[![React](https://img.shields.io/badge/React_19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)

*Reporting from Station IDNLAO16 — near the Forty Foot, where Dublin meets the Irish Sea.*

</div>

---

Sandycove Weather is a production weather dashboard pulling live data from a personal weather station perched on the coast at Sandycove, just metres from the famous [Forty Foot](https://en.wikipedia.org/wiki/Forty_Foot) swimming spot in Dun Laoghaire. It combines hyper-local station readings with national forecasts, sea conditions, tide times, and three live webcam feeds — everything a sea swimmer, walker, or weather-curious local needs before heading out the door.

## Features

### Current Conditions
Real-time readings from a local personal weather station (PWS IDNLAO16) situated at Sandycove: temperature, feels-like, wind speed and direction, humidity, barometric pressure with trend indicator (rising/falling/steady), rain rate, daily rainfall total, UV index, solar radiation, and sunrise/sunset times. A stale-data indicator appears if the station goes offline.

### Rain Alarm
A 15-minute precipitation nowcast displayed as visual bars, powered by Open-Meteo's minutely data. Know exactly when rain is arriving — or when it will stop.

### Met Eireann Weather Warnings
Active warnings for the Dublin region are displayed in a colour-coded banner (yellow, orange, red) with expandable details, onset/expiry times, and affected regions.

### Today's Charts
Interactive Recharts graphs for the current day: temperature curve, wind speed and gusts, cumulative rainfall, and barometric pressure — all built from station observations updated every 5 minutes.

### Forecast
- **Hourly rail** — scrollable 48-hour forecast starting from the current hour (not midnight), with temperature, wind, precipitation probability, and weather icons
- **Daily cards** — 7-day outlook with highs, lows, and conditions
- **National text forecast** — Met Eireann's written forecast for context and colour

### Sea Conditions
Sea surface temperature, wave height, wave period, and wave direction from Open-Meteo marine data. Dublin Port tide times (high and low) sourced from Marine Institute Ireland's ERDDAP API — showing today and tomorrow's tides (up to 8 tide events). Plus the all-important question:

> **Good for a swim?** — A swim suitability indicator for the Forty Foot based on sea temp, wind, rain, wave height, tide state, and UV index. Includes smart tide scoring that rewards high tide conditions (the Forty Foot is best enjoyed at high water) and penalties for low tide, heavy rain, or rough waves.

### Webcams
Three live webcam feeds from Sandycove and Dun Laoghaire harbour with auto-refreshing snapshots, so you can see conditions with your own eyes before making the trip.

### Historical Explorer
Collapsible section with historical weather data:
- **Day view** — hourly charts and data table for any past date
- **Date range view** — daily summaries with high/low/average across a custom range
- Backed by D1 SQLite for persistent historical storage

### Dark Mode
Full dark mode with system preference detection and manual toggle. Maritime-themed throughout — ocean blues in light mode, deep navy in dark.

### Push Notifications
Notification subscription infrastructure for weather alerts, with subscribe/unsubscribe API endpoints ready for future alert triggers.

---

## Architecture

```
                          ┌──────────────────────────────────┐
                          │       Cloudflare Edge Network     │
                          │                                   │
  Browser ──── GET ──────►│  Astro SSR + React Islands        │
                          │         │                         │
                          │         ▼                         │
                          │  /api/* Edge API Routes (13)      │
                          │    │          │          │        │
                          │    ▼          ▼          ▼        │
                          │   KV Cache   D1 DB    Secrets     │
                          │  (hot data) (history) (API keys)  │
                          └────┬──────────┬──────────┬────────┘
                               │          │          │
              ┌────────────────┼──────────┼──────────┘
              ▼                ▼          ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
    │   Weather     │  │ OpenWeather  │  │   Open-Meteo     │
    │  Underground  │  │     Map      │  │  (fallback,      │
    │  (station)    │  │  (forecast)  │  │   rain alarm,    │
    │               │  │              │  │   marine/sea)    │
    └──────────────┘  └──────────────┘  └──────────────────┘
                                │
                         ┌──────────────┐
                         │   Met        │
                         │  Eireann     │
                         │ (warnings)   │
                         └──────────────┘
                                │
                         ┌──────────────┐
                         │   Marine     │
                         │  Institute   │
                         │  (tides)     │
                         └──────────────┘
```

### Resilience Strategy

Every API route follows a three-tier fallback chain:

1. **Primary source** — fetch fresh data from the upstream API
2. **Fallback source** — if primary fails, try an alternative provider (e.g., Open-Meteo when Met Eireann is down)
3. **Stale cache** — if all sources fail, serve the last known good data from KV with `isStale: true`

The UI never breaks. If data is stale, a subtle indicator tells the user — but the dashboard keeps working.

### Cache Strategy

All responses are cached in Cloudflare KV with endpoint-specific TTLs:

| Endpoint | TTL | Rationale |
|---|---|---|
| `/api/current` | 5 min | Station updates every ~5 min |
| `/api/today` | 5 min | Observation history grows throughout the day |
| `/api/rain-alarm` | 5 min | Nowcast data changes rapidly |
| `/api/warnings` | 10 min | Warnings don't change that often |
| `/api/forecast` | 30 min | Forecast models update infrequently |
| `/api/sea` | 30 min | Marine conditions shift slowly |
| `/api/history/*` | 24 hours | Past data is immutable |

---

## API Endpoints

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/current` | Live station conditions |
| `GET` | `/api/today` | Today's observation history |
| `GET` | `/api/forecast` | Hourly + daily forecast |
| `GET` | `/api/forecast/text` | Met Eireann national text forecast |
| `GET` | `/api/warnings` | Active Met Eireann weather warnings |
| `GET` | `/api/rain-alarm` | 15-minute precipitation nowcast |
| `GET` | `/api/sea` | Sea temp, waves, tides |
| `GET` | `/api/history/:date` | Historical observations for a given date |
| `GET` | `/api/history-range` | Daily summaries for a date range |
| `GET` | `/api/health` | Upstream source health check |
| `GET` | `/api/status` | System status |

Every response includes `source`, `fetchedAt`, `isStale`, and `fallbackUsed` metadata.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Astro 6](https://astro.build) with React islands |
| UI | [React 19](https://react.dev) + [TanStack Query](https://tanstack.com/query) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com) with custom maritime palette |
| Charts | [Recharts](https://recharts.org) |
| Runtime | [Cloudflare Workers](https://workers.cloudflare.com) |
| Cache | [Cloudflare KV](https://developers.cloudflare.com/kv/) |
| Database | [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite at the edge) |
| Analytics | [Cloudflare Web Analytics](https://developers.cloudflare.com/analytics/) (privacy-first, no cookies) |
| XML parsing | [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) |
| Typography | [Fraunces](https://fonts.google.com/specimen/Fraunces) (display) + [DM Sans](https://fonts.google.com/specimen/DM+Sans) (body) |
| Design | Glass-morphism cards, ocean gradient header with Scotsman's Bay background photo (CC Wikimedia Commons), wave-pattern texture |

---

## Data Sources

| Source | Used For | Type |
|---|---|---|
| [Weather Underground](https://www.wunderground.com/) | API delivering data from local PWS IDNLAO16 (current conditions, observations, history) | Primary |
| [OpenWeatherMap](https://openweathermap.org/) | Hourly/daily forecast for Dun Laoghaire area | Primary |
| [Met Eireann](https://www.met.ie/) | Weather warnings, text forecast | Primary |
| [Open-Meteo](https://open-meteo.com/) | Forecast fallback, rain alarm nowcast, historical fallback, marine/sea data | Fallback + supplementary |
| [Marine Institute Ireland](https://www.marine.ie/) | Dublin Port tide predictions (ERDDAP API) — today + tomorrow, up to 8 tide events | Primary |
| [IPCamLive](https://www.ipcamlive.com/) | Sandycove and Dun Laoghaire webcam snapshots | Primary |

---

## Development

```bash
# Install dependencies
bun install

# Start dev server
bun run dev

# Preview with Wrangler (local Cloudflare emulation)
bun run preview

# Build and deploy
bun run deploy

# Run D1 migrations
bun run cf:migrate
```

Secrets are managed via `.env` for local development and `wrangler secret` for production.

---

## Location

Sandycove sits on the southern shore of Dublin Bay, a small coastal village in Dun Laoghaire-Rathdown. It is best known for the [Forty Foot](https://en.wikipedia.org/wiki/Forty_Foot) — an open-air sea swimming spot that has been in use for over 250 years — and for the [James Joyce Tower](https://en.wikipedia.org/wiki/James_Joyce_Tower_and_Museum), the Martello tower that opens *Ulysses*. The weather station sits nearby at coordinates 53.2867N, 6.1179W, reporting as PWS IDNLAO16 on the Weather Underground network.

---

<div align="center">

*Weather from local station IDNLAO16 · Forecast from OpenWeatherMap · Warnings from Met Éireann · Sea data from Open-Meteo & Marine Institute Ireland*

</div>
