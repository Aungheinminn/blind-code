import { boolean, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export type SupabaseIntegration = {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
  databaseUrl?: string;
  connectedAt: string;
};

export type ProjectIntegrations = {
  supabase?: SupabaseIntegration;
};

export type PublicSupabaseIntegration = Omit<
  SupabaseIntegration,
  "serviceRoleKey" | "databaseUrl"
> & {
  hasServiceRoleKey: boolean;
  hasDatabaseUrl: boolean;
};

export type PublicProjectIntegrations = {
  supabase?: PublicSupabaseIntegration;
};

export const toPublicIntegrations = (
  integrations: ProjectIntegrations | null | undefined,
): PublicProjectIntegrations | null => {
  if (!integrations) return null;
  const out: PublicProjectIntegrations = {};
  if (integrations.supabase) {
    const { serviceRoleKey, databaseUrl, ...rest } = integrations.supabase;
    out.supabase = {
      ...rest,
      hasServiceRoleKey: Boolean(serviceRoleKey),
      hasDatabaseUrl: Boolean(databaseUrl),
    };
  }
  return out;
};

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
  integrations: jsonb("integrations").$type<ProjectIntegrations>(),
  isArchived: boolean("is_archived").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
