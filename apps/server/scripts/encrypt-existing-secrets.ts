import { eq } from "drizzle-orm";
import { db, hasDb, schema } from "../db/client";
import { encrypt, isEncrypted } from "../services/crypto";

if (!hasDb || !db) {
  console.error("DATABASE_URL not set — nothing to migrate.");
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");
if (dryRun) console.log("[dry-run] no writes will be performed");

let userPats = 0;
let projectServiceKeys = 0;
let projectDbUrls = 0;
let userPatsAlready = 0;
let projectServiceKeysAlready = 0;
let projectDbUrlsAlready = 0;

const users = await db.select().from(schema.users);
for (const u of users) {
  const s = u.integrations?.supabase;
  if (!s?.accessToken) continue;
  if (isEncrypted(s.accessToken)) {
    userPatsAlready++;
    continue;
  }
  const nextIntegrations = {
    ...(u.integrations ?? {}),
    supabase: { ...s, accessToken: encrypt(s.accessToken) },
  };
  if (!dryRun) {
    await db
      .update(schema.users)
      .set({ integrations: nextIntegrations, updatedAt: new Date() })
      .where(eq(schema.users.id, u.id));
  }
  userPats++;
}

const projects = await db.select().from(schema.projects);
for (const p of projects) {
  const s = p.integrations?.supabase;
  if (!s) continue;
  let touched = false;
  const nextSupabase = { ...s };
  if (s.serviceRoleKey) {
    if (isEncrypted(s.serviceRoleKey)) {
      projectServiceKeysAlready++;
    } else {
      nextSupabase.serviceRoleKey = encrypt(s.serviceRoleKey);
      projectServiceKeys++;
      touched = true;
    }
  }
  if (s.databaseUrl) {
    if (isEncrypted(s.databaseUrl)) {
      projectDbUrlsAlready++;
    } else {
      nextSupabase.databaseUrl = encrypt(s.databaseUrl);
      projectDbUrls++;
      touched = true;
    }
  }
  if (!touched) continue;
  const nextIntegrations = { ...(p.integrations ?? {}), supabase: nextSupabase };
  if (!dryRun) {
    await db
      .update(schema.projects)
      .set({ integrations: nextIntegrations, updatedAt: new Date() })
      .where(eq(schema.projects.id, p.id));
  }
}

console.log(`\nMigration ${dryRun ? "(dry-run) " : ""}complete.`);
console.log(`  User PATs:                encrypted ${userPats}, already ${userPatsAlready}`);
console.log(`  Project service-role keys: encrypted ${projectServiceKeys}, already ${projectServiceKeysAlready}`);
console.log(`  Project database URLs:     encrypted ${projectDbUrls}, already ${projectDbUrlsAlready}`);

process.exit(0);
