import {
  integer,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export type CreditsReason =
  | "signup_grant"
  | "agent_run"
  | "manual_grant"
  | "topup"
  | "refund"
  | "adjustment";

export type CreditsTransactionMeta = {
  provider?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  note?: string;
};

export const creditsTransactions = pgTable("credits_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  delta: integer("delta").notNull(),
  reason: varchar("reason", { length: 32 }).notNull().$type<CreditsReason>(),
  balanceAfter: integer("balance_after").notNull(),
  meta: jsonb("meta").$type<CreditsTransactionMeta>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
