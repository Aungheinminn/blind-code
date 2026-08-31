import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@vibe/shared";

const url = process.env.DATABASE_URL?.trim();

export const hasDb = Boolean(url);

let sql: ReturnType<typeof postgres> | null = null;
let dbInstance: ReturnType<typeof drizzle> | null = null;

if (url) {
  sql = postgres(url, { max: 5, prepare: false });
  dbInstance = drizzle(sql, { schema });
  console.log("[db] connected via DATABASE_URL");
} else {
  console.warn("[db] DATABASE_URL not set — persistence disabled (agent still works)");
}

export const db = dbInstance;
export { schema };
