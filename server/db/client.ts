import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { join } from "path";
import * as schema from "./schema";

const DB_PATH = join(import.meta.dir, "../../curated.db");

const sqlite = new Database(DB_PATH, { create: true });

// Enable WAL for better concurrent read performance
sqlite.run("PRAGMA journal_mode = WAL;");
sqlite.run("PRAGMA foreign_keys = ON;");

export const db = drizzle(sqlite, { schema });
export { sqlite };
