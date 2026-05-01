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
│   ├── analyze-reviews.ts  # ML review analysis pipeline (orchestrator)
│   └── lib/
│       ├── keywords.ts     # Bilingual (ID/EN) keyword signal rules
│       ├── signal-extractor.ts  # Keyword + LLM (gpt-4o-mini) extraction
│       ├── aggregator.ts   # Weighted confidence aggregation
│       └── trend-analyzer.ts   # Trend windows + popularity scoring
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

## Environment variables

| Variable | Used by | Required |
|---|---|---|
| `GOOGLE_PLACES_API_KEY` | `seed`, `analyze` | For fetching from Google Places API |
| `OPENAI_API_KEY` | `analyze` | For LLM pass in review analysis (optional) |
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
