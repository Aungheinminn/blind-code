import { boolean, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  description: text("description"),
  deploymentSettings: jsonb("deployment_settings").$type<{
    provider?: "vercel" | "cloudflare" | "netlify" | "custom";
    framework?: string;
    env?: Record<string, string>;
  }>(),
  isArchived: boolean("is_archived").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
