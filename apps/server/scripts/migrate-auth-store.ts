import { db, hasDb } from "../db/client";
import { readAuth } from "../services/authStore";
import { getUserById, setUserProviderKey } from "../db/repo";
import type { UserProviderKeys } from "@vibe/shared";

const PROVIDER_NAMES: Array<keyof UserProviderKeys> = [
  "anthropic",
  "openai",
  "google",
  "openrouter",
];

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const positional = args.filter((a) => !a.startsWith("--"));
const userId = positional[0];

if (!userId) {
  console.error("usage: bun scripts/migrate-auth-store.ts <userId> [--dry-run]");
  console.error("");
  console.error(
    "Imports each provider key from the local ~/.config/blind-code/auth.json file store",
  );
  console.error("into the given user's encrypted DB record. Skips providers the user already has.");
  process.exit(1);
}

if (!hasDb || !db) {
  console.error("DATABASE_URL not set — cannot write to DB.");
  process.exit(1);
}

const user = await getUserById(userId);
if (!user) {
  console.error(`user ${userId} not found`);
  process.exit(1);
}

const auth = await readAuth();
const fileEntries = Object.entries(auth.providers ?? {});
if (fileEntries.length === 0) {
  console.log("auth.json has no provider keys — nothing to migrate.");
  process.exit(0);
}

const existing = user.integrations?.providers ?? {};

let imported = 0;
let skippedExisting = 0;
let skippedUnknown = 0;

for (const [provider, cred] of fileEntries) {
  if (!PROVIDER_NAMES.includes(provider as keyof UserProviderKeys)) {
    console.log(`  - ${provider}: unknown provider, skipping`);
    skippedUnknown++;
    continue;
  }
  if (existing[provider as keyof UserProviderKeys]) {
    console.log(`  - ${provider}: user already has a DB key, skipping`);
    skippedExisting++;
    continue;
  }
  const apiKey = cred?.apiKey?.trim();
  if (!apiKey) {
    console.log(`  - ${provider}: file key is empty, skipping`);
    continue;
  }
  if (dryRun) {
    console.log(`  - ${provider}: would import (••••${apiKey.slice(-4)})`);
  } else {
    await setUserProviderKey(userId, provider as keyof UserProviderKeys, apiKey);
    console.log(`  - ${provider}: imported (••••${apiKey.slice(-4)})`);
  }
  imported++;
}

console.log("");
console.log(`Migration ${dryRun ? "(dry-run) " : ""}complete for user ${userId}.`);
console.log(`  imported: ${imported}`);
console.log(`  skipped (already in DB): ${skippedExisting}`);
if (skippedUnknown > 0) {
  console.log(`  skipped (unknown provider): ${skippedUnknown}`);
}

process.exit(0);
