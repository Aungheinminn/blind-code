import { sql } from "drizzle-orm";
import { db, hasDb } from "../db/client";

if (!hasDb || !db) {
  console.error("DATABASE_URL not set — nothing to wipe.");
  process.exit(1);
}

if (!process.argv.includes("--force")) {
  console.error(
    "Refusing to wipe without --force. This deletes ALL users, sessions, projects, files, agent history.",
  );
  process.exit(1);
}

const start = Date.now();
await db.execute(sql`
  TRUNCATE
    turn_events,
    turns,
    tool_call_cache,
    agent_actions,
    agent_sessions,
    files,
    projects,
    sessions,
    users
  RESTART IDENTITY CASCADE;
`);

console.log(`Wiped in ${Date.now() - start}ms.`);
process.exit(0);
