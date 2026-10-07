import { db, hasDb } from "../db/client";
import { getBalance, grant } from "../services/credits";
import { getUserById } from "../db/repo";
import type { CreditsReason } from "@vibe/shared";

const VALID_REASONS: ReadonlyArray<CreditsReason> = [
  "signup_grant",
  "agent_run",
  "manual_grant",
  "topup",
  "refund",
  "adjustment",
];

const args = process.argv.slice(2);
const [userId, rawAmount, rawReason, ...noteParts] = args;

if (!userId || !rawAmount) {
  console.error(
    "usage: bun scripts/credits-grant.ts <userId> <amount> [reason] [note...]",
  );
  console.error("");
  console.error(
    `  reason   one of: ${VALID_REASONS.join(", ")} (default: manual_grant)`,
  );
  console.error("  note     free-form text, stored in meta.note");
  console.error("");
  console.error("examples:");
  console.error("  bun scripts/credits-grant.ts 123e4567-... 5000");
  console.error(
    "  bun scripts/credits-grant.ts 123e4567-... 10000 refund 'oct 7 outage'",
  );
  process.exit(1);
}

if (!hasDb || !db) {
  console.error("DATABASE_URL not set — cannot write to DB.");
  process.exit(1);
}

const amount = Number(rawAmount);
if (!Number.isFinite(amount) || amount === 0 || !Number.isInteger(amount)) {
  console.error(`amount must be a non-zero integer; got "${rawAmount}"`);
  process.exit(1);
}

const reason: CreditsReason = rawReason
  ? VALID_REASONS.includes(rawReason as CreditsReason)
    ? (rawReason as CreditsReason)
    : (() => {
        console.error(
          `invalid reason "${rawReason}"; must be one of: ${VALID_REASONS.join(", ")}`,
        );
        process.exit(1);
      })()
  : "manual_grant";

const note = noteParts.length > 0 ? noteParts.join(" ") : undefined;

const user = await getUserById(userId);
if (!user) {
  console.error(`user ${userId} not found`);
  process.exit(1);
}

const before = await getBalance(userId);

if (amount < 0) {
  console.error(
    `negative amounts not supported by this CLI — use the admin debit script when it exists`,
  );
  process.exit(1);
}

const after = await grant(userId, amount, reason, note ? { note } : undefined);

console.log(`user:    ${userId} (${user.email})`);
console.log(`reason:  ${reason}${note ? ` — "${note}"` : ""}`);
console.log(`balance: ${before.toLocaleString()} → ${after.toLocaleString()} (+${amount.toLocaleString()})`);

process.exit(0);
