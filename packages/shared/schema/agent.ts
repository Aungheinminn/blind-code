import { jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const agentSessions = pgTable("agent_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull(),
  model: varchar("model", { length: 120 }).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const agentActions = pgTable("agent_actions", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id").notNull(),
  actionType: varchar("action_type", { length: 80 }).notNull(),
  summary: text("summary"),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  stdout: text("stdout"),
  stderr: text("stderr"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
