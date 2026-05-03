import { boolean, integer, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const files = pgTable("files", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull(),
  path: varchar("path", { length: 512 }).notNull(),
  content: text("content").notNull(),
  isDirectory: boolean("is_directory").default(false).notNull(),
  sizeBytes: integer("size_bytes").default(0).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
