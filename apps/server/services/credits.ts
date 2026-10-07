import { eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import {
  creditsTransactions,
  users,
  type CreditsReason,
  type CreditsTransactionMeta,
} from "@vibe/shared";

export const getBalance = async (userId: string): Promise<number> => {
  if (!db) return 0;
  const rows = await db
    .select({ creditsBalance: users.creditsBalance })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0]?.creditsBalance ?? 0;
};

type MutateArgs = {
  userId: string;
  delta: number;
  reason: CreditsReason;
  meta?: CreditsTransactionMeta;
};

// One transaction: update users.credits_balance and append a credits_transactions
// row with the resulting balance. Both tables stay consistent even under
// concurrent debits.
const mutate = async (args: MutateArgs): Promise<number> => {
  if (!db) throw new Error("db not available");
  if (args.delta === 0) return getBalance(args.userId);

  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(users)
      .set({
        creditsBalance: sql`${users.creditsBalance} + ${args.delta}`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, args.userId))
      .returning({ creditsBalance: users.creditsBalance });

    if (!row) throw new Error(`user ${args.userId} not found`);
    const balanceAfter = row.creditsBalance;

    await tx.insert(creditsTransactions).values({
      userId: args.userId,
      delta: args.delta,
      reason: args.reason,
      balanceAfter,
      meta: args.meta ?? null,
    });

    return balanceAfter;
  });
};

export const grant = async (
  userId: string,
  amount: number,
  reason: CreditsReason,
  meta?: CreditsTransactionMeta,
): Promise<number> => {
  if (amount <= 0) throw new Error("grant amount must be positive");
  return mutate({ userId, delta: amount, reason, meta });
};

export const debit = async (
  userId: string,
  amount: number,
  reason: CreditsReason,
  meta?: CreditsTransactionMeta,
): Promise<number> => {
  if (amount <= 0) throw new Error("debit amount must be positive");
  return mutate({ userId, delta: -amount, reason, meta });
};

export const FREE_TIER_GRANT = 2000;
