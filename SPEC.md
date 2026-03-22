| Expert(s) | Cloudflare engineer; full-stack architect; LLM prompt engineer; frontend lead                                                                                                                                                                                   |
| :-------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Question  | Generate a single high-quality implementation prompt that instructs an LLM coding assistant to build the full weather app based on the finalized hybrid plan.                                                                                                   |
| Plan      | Convert the upgraded plan into a deterministic, step-by-step build prompt. Include constraints, architecture decisions, file structure, phased execution, and exact expectations for outputs. Optimize for correctness on first pass and minimal hallucination. |

---

Here is your **one-shot implementation prompt**. Paste this directly into your coding assistant and run it step-by-step.

---

# MASTER PROMPT — Build `weather.billgleeson.com`

You are building a production-grade weather web app using Cloudflare.

Read this entire prompt carefully before starting. Do not skip ahead. Follow phases exactly.

---

## CONTEXT

We are building a **public weather dashboard** for:

* **Domain:** `weather.billgleeson.com`
* **Station:** Weather Underground PWS `IDNLAO16`
* **Location:** Sandycove, Dublin, Ireland (~53.2867, -6.1179)

This app must:

* Show live station data
* Show forecast and warnings (Ireland-specific)
* Show historical charts
* Be fast, clean, and mobile-first
* Be resilient to API failures
* Never expose API keys client-side

---

## ARCHITECTURE (NON-NEGOTIABLE)

### Deployment model

* Cloudflare **Pages + Functions**
* Edge API routes under `/api/*`
* Frontend + backend in same repo

### Stack

* TypeScript everywhere
* Frontend: **Astro + React islands** (preferred) OR React + Vite if simpler
* Styling: Tailwind CSS
* Data fetching: TanStack Query
* Charts: Recharts
* XML parsing: fast-xml-parser

### Storage

* KV → hot cache
* D1 → historical storage

### Secrets

* Stored only via `wrangler secret`
* NEVER exposed to frontend

---

## DATA SOURCES

### Weather Underground (primary)

Use for:

* current conditions
* today observations
* historical data

### Met Éireann (primary forecast + warnings)

Use for:

* hourly forecast
* warnings
* text forecast

### Open-Meteo (fallback)

Use if:

* forecast fails
* historical gaps

---

## REQUIRED API ROUTES

You MUST implement these exactly:

```
GET /api/current
GET /api/today
GET /api/history/:date
GET /api/history-range?start=YYYYMMDD&end=YYYYMMDD
GET /api/forecast
GET /api/forecast/text
GET /api/warnings
GET /api/health
GET /api/status
```

Each response MUST include:

* `source`
* `fetchedAt`
* `isStale`
* `fallbackUsed`

---

## CACHE RULES

Use KV.

| Endpoint      | TTL       |
| ------------- | --------- |
| current       | 5 min     |
| today         | 5 min     |
| forecast      | 30–60 min |
| warnings      | 10–15 min |
| history past  | 24h       |
| history today | 15 min    |

---

## CORE FEATURES

### 1. Current Conditions

* temp
* feels like
* wind + direction
* humidity
* pressure
* rain rate + total
* UV
* solar radiation
* last updated
* station status (online/offline)

### 2. Warnings Banner

* only visible if active warning
* colour-coded (yellow/orange/red)
* expandable details
* filter to Dublin region

### 3. Today Charts

* temperature
* wind/gust
* rainfall
* pressure

### 4. Forecast

* hourly (24–48h)
* daily (5–10 days)
* optional text forecast

### 5. Historical Explorer

* day view (hourly)
* range view (daily summaries)
* charts + table

---

## NORMALIZATION RULES

* store timestamps in UTC
* render in Europe/Dublin
* metric units only
* unify all sources into one schema
* never let frontend parse raw upstream JSON

---

## RESILIENCE RULES

If any source fails:

* serve last cached data
* set `isStale: true`
* include reason
* do NOT break the UI

If station is offline:

* show last reading
* show stale indicator

---

## PROJECT STRUCTURE

You MUST generate this structure:

```
/src
  /components
  /lib
  /pages
/functions
  /api
  /_shared
/db/migrations
/public
wrangler.toml
package.json
README.md
```

---

## PHASED EXECUTION (MANDATORY)

You must follow this exact sequence.

---

### PHASE 0 — SETUP

Output:

* commands to scaffold project
* wrangler setup
* KV + D1 bindings
* env + secrets setup

Then STOP.

---

### PHASE 1 — CURRENT CONDITIONS

Build:

* `/api/current`
* minimal UI:

  * header
  * hero current temp
  * basic stats

Deploy-ready.

Then STOP.

---

### PHASE 2 — WARNINGS + HEALTH

Build:

* `/api/warnings`
* `/api/health`
* `/api/status`

UI:

* warning banner
* freshness indicators

Then STOP.

---

### PHASE 3 — TODAY CHARTS

Build:

* `/api/today`

UI:

* charts (temp, wind, rain, pressure)

Then STOP.

---

### PHASE 4 — FORECAST

Build:

* `/api/forecast`
* `/api/forecast/text`

Add:

* Met Éireann parsing
* fallback to Open-Meteo

UI:

* hourly rail
* daily cards

Then STOP.

---

### PHASE 5 — HISTORY

Build:

* `/api/history/:date`
* `/api/history-range`

Add:

* D1 persistence
* historical charts + table

Then STOP.

---

### PHASE 6 — POLISH

Add:

* PWA
* dark/light toggle
* performance improvements
* icons
* SEO metadata

---

## CODING RULES

* Use TypeScript strictly
* Define types first
* Build providers → normalizers → routes → UI
* Do not mix concerns
* Do not hardcode data shapes from upstream APIs in UI
* Include full code, not snippets
* Include install commands
* Include run instructions

---

## OUTPUT FORMAT

For EACH phase:

1. Commands
2. File tree
3. Full code (all files)
4. Explanation (short, practical)
5. Next step

Do NOT skip files.

---

## START NOW

Begin with:

**PHASE 0 — SETUP**

Provide:

* exact CLI commands
* wrangler config
* KV + D1 setup
* secrets setup
* project initialization

Then stop.
