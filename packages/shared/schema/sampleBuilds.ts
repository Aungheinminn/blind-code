import { integer, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const sampleBuilds = pgTable("sample_builds", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  description: text("description").notNull(),
  accent: varchar("accent", { length: 40 }).notNull(),
  prompt: text("prompt").notNull(),
  image: text("image"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
