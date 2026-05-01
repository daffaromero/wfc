import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { placesRouter } from "./routes/places";

const app = new Hono();

// CORS for dev (Vite proxy handles this in dev, but keep for flexibility)
app.use("/api/*", cors());

// API routes
app.route("/api/places", placesRouter);

// Health check
app.get("/api/health", (c) => c.json({ ok: true, ts: new Date().toISOString() }));

// Serve static build in production
app.use("/*", serveStatic({ root: "./dist" }));
app.get("/*", serveStatic({ path: "./dist/index.html" }));

const PORT = parseInt(process.env.PORT ?? "3001", 10);

console.log(`\n🚀  Curated. API running on http://localhost:${PORT}\n`);

export default {
  port: PORT,
  fetch: app.fetch,
};
