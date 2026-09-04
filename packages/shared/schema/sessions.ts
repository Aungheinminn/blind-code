import { index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { users } from "./users";

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    userAgent: text("user_agent"),
    ip: varchar("ip", { length: 64 }),
  },
  (t) => ({
    userIdx: index("sessions_user_id_idx").on(t.userId),
    expiresIdx: index("sessions_expires_at_idx").on(t.expiresAt),
  }),
);
