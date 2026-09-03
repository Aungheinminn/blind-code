import { relations } from "drizzle-orm";
import { agentActions, agentSessions, toolCallCache, turnEvents, turns } from "./agent";
import { files } from "./fs";
import { projects } from "./projects";
import { users } from "./users";

export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, {
    fields: [projects.ownerId],
    references: [users.id],
  }),
  files: many(files),
  agentSessions: many(agentSessions),
}));

export const filesRelations = relations(files, ({ one }) => ({
  project: one(projects, {
    fields: [files.projectId],
    references: [projects.id],
  }),
}));

export const agentSessionsRelations = relations(agentSessions, ({ one, many }) => ({
  project: one(projects, {
    fields: [agentSessions.projectId],
    references: [projects.id],
  }),
  actions: many(agentActions),
  toolCallCache: many(toolCallCache),
  turns: many(turns),
}));

export const agentActionsRelations = relations(agentActions, ({ one }) => ({
  session: one(agentSessions, {
    fields: [agentActions.sessionId],
    references: [agentSessions.id],
  }),
}));

export const toolCallCacheRelations = relations(toolCallCache, ({ one }) => ({
  session: one(agentSessions, {
    fields: [toolCallCache.sessionId],
    references: [agentSessions.id],
  }),
}));

export const turnsRelations = relations(turns, ({ one, many }) => ({
  session: one(agentSessions, {
    fields: [turns.sessionId],
    references: [agentSessions.id],
  }),
  project: one(projects, {
    fields: [turns.projectId],
    references: [projects.id],
  }),
  events: many(turnEvents),
}));

export const turnEventsRelations = relations(turnEvents, ({ one }) => ({
  turn: one(turns, {
    fields: [turnEvents.turnId],
    references: [turns.id],
  }),
}));
