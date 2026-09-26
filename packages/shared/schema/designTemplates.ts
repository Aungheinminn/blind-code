import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const designTemplateOrigin = pgEnum("design_template_origin", [
  "builtin",
  "user",
  "agent",
]);

export const designTemplates = pgTable("design_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: varchar("slug", { length: 80 }).unique(),
  name: varchar("name", { length: 160 }).notNull(),
  description: text("description"),
  content: text("content").notNull(),
  parsedTokens: jsonb("parsed_tokens"),
  origin: designTemplateOrigin("origin").notNull(),
  ownerUserId: uuid("owner_user_id"),
  sourceProjectId: uuid("source_project_id"),
  isReadOnly: boolean("is_read_only").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
