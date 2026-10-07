import type { Elysia } from "elysia";
import { desc, eq } from "drizzle-orm";
import { db, hasDb } from "../db/client";
import { creditsTransactions } from "@vibe/shared";
import { getUserFromRequest } from "../services/authGuard";
import { getBalance } from "../services/credits";

const unauthorized = (set: { status?: number | string }) => {
  set.status = 401;
  return { error: "unauthorized" };
};

const dbUnavailable = (set: { status?: number | string }) => {
  set.status = 503;
  return { error: "database not configured" };
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export const creditsController = (app: Elysia) =>
  app
    .get("/credits/balance", async ({ request, set }) => {
      if (!hasDb) return dbUnavailable(set);
      const user = await getUserFromRequest(request);
      if (!user) return unauthorized(set);
      const balance = await getBalance(user.id);
      return { data: { balance } };
    })
    .get("/credits/transactions", async ({ request, query, set }) => {
      if (!hasDb) return dbUnavailable(set);
      if (!db) return dbUnavailable(set);
      const user = await getUserFromRequest(request);
      if (!user) return unauthorized(set);

      const rawLimit = Number(query?.limit);
      const limit = Number.isFinite(rawLimit)
        ? Math.min(Math.max(1, Math.trunc(rawLimit)), MAX_LIMIT)
        : DEFAULT_LIMIT;
      const rawOffset = Number(query?.offset);
      const offset =
        Number.isFinite(rawOffset) && rawOffset > 0 ? Math.trunc(rawOffset) : 0;

      const rows = await db
        .select()
        .from(creditsTransactions)
        .where(eq(creditsTransactions.userId, user.id))
        .orderBy(desc(creditsTransactions.createdAt))
        .limit(limit)
        .offset(offset);

      return { data: { items: rows, limit, offset } };
    });
