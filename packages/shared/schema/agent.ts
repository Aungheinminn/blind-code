import {
  bigserial,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

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

export const toolCallCache = pgTable(
  "tool_call_cache",
  {
    sessionId: uuid("session_id").notNull(),
    toolCallId: varchar("tool_call_id", { length: 200 }).notNull(),
    toolName: varchar("tool_name", { length: 80 }).notNull(),
    inputHash: varchar("input_hash", { length: 64 }).notNull(),
    result: jsonb("result").$type<unknown>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.sessionId, t.toolCallId] }),
  }),
);

export type TurnStatus = "running" | "done" | "failed" | "cancelled";

export const turns = pgTable("turns", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id").notNull(),
  projectId: uuid("project_id").notNull(),
  status: varchar("status", { length: 16 }).$type<TurnStatus>().notNull().default("running"),
  nextEventOrdinal: integer("next_event_ordinal").notNull().default(0),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  lastError: text("last_error"),
});

export const turnEvents = pgTable(
  "turn_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    turnId: uuid("turn_id").notNull(),
    ordinal: integer("ordinal").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    turnOrdinal: uniqueIndex("turn_events_turn_ordinal_uq").on(t.turnId, t.ordinal),
  }),
);
