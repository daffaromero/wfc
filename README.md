# Curated.

> The best cafes to work from in Jakarta and Yogyakarta — vetted for WiFi, plugs, noise level, prayer rooms, and more.

A personal encyclopedia of WFC (Work From Cafe) places. Each entry is hand-curated with real WFC data: internet speed, plug availability, noise level, prayer room access, seating types, menu price range, and opening hours.

---

## Stack

| Layer | Technology |
|---|---|
| Runtime | [Bun](https://bun.sh) 1.x |
| Frontend | React 19 + TypeScript + Vite 8 |
| Styling | Tailwind CSS v4 |
| Routing | React Router v7 |
| API server | [Hono](https://hono.dev) on Bun |
| Database | SQLite via `bun:sqlite` + [Drizzle ORM](https://orm.drizzle.team) |
| Icons | [Lucide React](https://lucide.dev) |

---

## Project structure

```
.
├── server/
│   ├── db/
│   │   ├── schema.ts       # Drizzle table definitions
│   │   └── client.ts       # SQLite connection (WAL mode)
│   ├── routes/
│   │   └── places.ts       # GET /api/places, GET /api/places/:id
│   └── index.ts            # Hono app + static file serving
├── src/
│   ├── components/         # Shared UI (Header, Badge, PlaceCard, FilterBar)
│   ├── hooks/              # usePlaces(), usePlace() — fetch from API
│   ├── layouts/            # RootLayout with Header + footer
│   ├── lib/                # cn(), label/colour mappers
│   ├── pages/              # BrowsePage, PlaceDetailPage
│   └── types/              # Place, WfcFeatures, PlaceFilters types
├── scripts/
│   ├── db-seed.ts          # Seed curated.db from src/data/places.ts
│   ├── seed-places.ts      # Fetch new places from Google Places API
│   ├── discover-cafes.ts   # Sweep Maps for cafes, score WFC + mushola, write DB
│   ├── analyze-reviews.ts  # ML review analysis pipeline (orchestrator)
│   └── lib/
│       ├── keywords.ts     # Bilingual (ID/EN) keyword signal rules
│       ├── signal-extractor.ts  # Keyword + LLM (gpt-4o-mini) extraction
│       ├── aggregator.ts   # Weighted confidence aggregation
│       ├── trend-analyzer.ts   # Trend windows + popularity scoring
│       ├── places-api.ts   # Google Places API (New) client
│       ├── wfc-score.ts    # Coverage-aware WFC score + mushola verdict
│       ├── place-dedup.ts  # Cross-source place identity matching
│       └── geo.ts          # Haversine distance
├── curated.db              # Local SQLite database (gitignored)
└── drizzle.config.ts       # Drizzle Kit config
```

---

## Getting started

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.1

### Install

```bash
bun install
```

### Seed the database

```bash
bun run db:seed
```

This reads `src/data/places.ts` and writes to `curated.db`. Run with `--reset` to wipe and reseed:

```bash
bun run db:seed --reset
```

### Run in development

```bash
bun run dev
```

This starts both the Vite dev server (`:5173`) and the Hono API server (`:3001`) concurrently. The Vite proxy forwards `/api/*` to `:3001` — no CORS config needed.

### Build for production

```bash
bun run build   # tsc + vite build → dist/
bun run server  # Hono serves dist/ as static + /api routes
```

---

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start Vite + Hono in watch mode |
| `bun run build` | TypeScript check + Vite production build |
| `bun run db:seed` | Seed SQLite from `src/data/places.ts` |
| `bun run db:push` | Push Drizzle schema to `curated.db` |
| `bun run db:studio` | Open Drizzle Studio to inspect/edit data |
| `bun run seed` | Fetch new places from Google Places API |
| `bun run discover` | Sweep Google Maps for cafes, score them, write new rows |
| `bun run discover:dry` | Same sweep, report only, no DB writes |
| `bun run discover:cheap` | Small keyword-only dry run (1 page, 10 candidates) |
| `bun run analyze` | Run ML review analysis pipeline |
| `bun run analyze:keywords` | Keyword-only analysis (no OpenAI) |

---

## Review analysis pipeline

The ML pipeline (`scripts/`) extracts WFC signal from Google Maps reviews:

1. **Signal extraction** — two passes per review: regex keyword rules (bilingual ID/EN) then an optional LLM pass (gpt-4o-mini) for semantic understanding
2. **Aggregation** — weighted votes per WFC dimension (WiFi speed, plugs, noise, prayer room, etc.) with recency boost and rating-alignment confidence
3. **Trend analysis** — rolling 30d / 90d / 365d windows with review velocity and rating delta
4. **Popularity scoring** — composite 0–100 trending score

```bash
GOOGLE_PLACES_API_KEY=xxx OPENAI_API_KEY=yyy bun run analyze --place anomali-senopati
GOOGLE_PLACES_API_KEY=xxx bun run analyze:keywords   # free, keyword-only
```

---

## Cafe discovery

`bun run discover` finds cafes nobody has curated yet and answers the two
questions that decide whether a place is worth the trip: can you work from it,
and can you pray there.

```bash
GOOGLE_PLACES_API_KEY=xxx OPENAI_API_KEY=yyy bun run discover:dry
GOOGLE_PLACES_API_KEY=xxx bun run discover --city yogyakarta --min-score 60
GOOGLE_PLACES_API_KEY=xxx bun run discover:cheap   # small keyword-only probe
```

Five stages:

1. **Discover**: text search over an area grid (12 Jakarta areas, 6 Jogja),
   three query phrasings each, paginated past Google's 20-result page cap.
2. **Filter**: drop closed, low-rated, and thin-review places, plus anything
   already in `curated.db`.
3. **Interrogate**: pull full details (up to 5 reviews + amenity flags) and run
   them through the same signal pipeline `analyze` uses.
4. **Score**: a 0-100 WFC score over WiFi, plugs, noise, seating, time limit,
   food, and parking, plus a mushola verdict.
5. **Write**: insert rows above `--min-score` (tagged `unverified`, blank
   `lastVerified`) and emit `reports/discovery-<date>.{json,md}`.

### Reading the score

The score is **normalized over the dimensions with actual evidence**, and
`coverage` reports how much of the rubric that was. `92/100 at 30% coverage`
means three reviewers liked the WiFi and nobody mentioned anything else; it is
not a better cafe than `78/100 at 90% coverage`. Anything under 35% coverage is
labelled `unknown` and never written to the DB.

### Mushola detection

Two sources, in order:

| Verdict | Means |
|---|---|
| `onsite` | Reviews mention a mushola at the cafe. Sets `wfcPrayerRoom = true`. |
| `nearby` | No review evidence, but a mosque or mushola sits within `--prayer-radius` (default 250m). Recorded in the curator note only. |
| `absent` | Reviews say there is no prayer room. |
| `unknown` | Nothing either way. |

Indonesian musholas are usually not tagged with the Places `mosque` type, so the
proximity probe searches both `mosque` and the text query "mushola".

### Cost control

Every candidate costs one details call plus up to two prayer-probe calls, so the
defaults stay conservative: `--limit 40` candidates, `--pages 2`. The run prints
its exact API call count at the end. Start with `discover:cheap`.

Discovered rows are **guesses from at most five reviews**. They land tagged
`["auto-discovered","unverified"]` with an empty `lastVerified` so they are easy
to find and confirm in person.

---

## Environment variables

| Variable | Used by | Required |
|---|---|---|
| `GOOGLE_PLACES_API_KEY` | `seed`, `analyze`, `discover` | For fetching from Google Places API |
| `OPENAI_API_KEY` | `analyze`, `discover` | For LLM pass in review analysis (optional) |
| `PORT` | `server/index.ts` | API server port (default: `3001`) |

---

## Cities

- **Jakarta** — South Jakarta focus (Senopati, Kemang, SCBD, Sudirman, Menteng, Tebet)
- **Yogyakarta** — City centre, Prawirotaman, Malioboro area

---

## Data model

Each place stores:
- Identity: name, city, area, address, coordinates, Google Place ID
- Media: photos (URL array), Google rating + review count
- Hours + links: opening hours, website, Instagram
- **WFC features**: WiFi (available, speed, password), plugs, noise level, prayer room, parking, seating (types, capacity, time limit), menu (specialty coffee, food, price range 1–4, highlights)
- Meta: tags, last-verified date, curator note
