import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { placesRouter } from "./routes/places";
import { syncFromMaps } from "./scripts/sync-from-maps";

const app = new Hono();

// CORS for dev (Vite proxy handles this in dev, but keep for flexibility)
app.use("/api/*", cors());

// API routes
app.route("/api/places", placesRouter);

// Manual "Sync from Maps" trigger — pulls new places from the saved list.
app.post("/api/sync", async (c) => {
  try {
    const summary = await syncFromMaps();
    return c.json(summary);
  } catch (err) {
    console.error("Sync failed:", err);
    return c.json({ error: (err as Error).message }, 502);
  }
});

// Health check
app.get("/api/health", (c) => c.json({ ok: true, ts: new Date().toISOString() }));

// Serve static build in production
app.use("/*", serveStatic({ root: "./dist" }));
app.get("/*", serveStatic({ path: "./dist/index.html" }));

const PORT = parseInt(process.env.PORT ?? "3001", 10);

console.log(`\n🚀  Curated. API running on http://localhost:${PORT}\n`);

// Refresh the place list from the Maps saved list on boot, so a restart is
// enough to pick up newly-added cafes. Non-blocking (server starts immediately)
// and non-fatal. Opt out with SYNC_ON_BOOT=false.
if (process.env.SYNC_ON_BOOT !== "false") {
  syncFromMaps()
    .then((s) => {
      if (s.added > 0) {
        console.log(`🔄  Sync on boot: +${s.added} new place(s) from Maps list.`);
      }
    })
    .catch((err) => console.warn("⚠  Sync on boot failed:", (err as Error).message));
}

export default {
  port: PORT,
  fetch: app.fetch,
};
