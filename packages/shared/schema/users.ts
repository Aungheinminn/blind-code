import { jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export type SupabaseAccountIntegration = {
  accessToken: string;
  connectedAt: string;
};

export type VercelAccountIntegration = {
  apiToken: string;
  last4: string;
  connectedAt: string;
};

export type ProviderKey = {
  apiKey: string;
  last4: string;
  updatedAt: string;
};

export type UserProviderKeys = {
  anthropic?: ProviderKey;
  openai?: ProviderKey;
  google?: ProviderKey;
  openrouter?: ProviderKey;
};

export type UserIntegrations = {
  supabase?: SupabaseAccountIntegration;
  vercel?: VercelAccountIntegration;
  providers?: UserProviderKeys;
};

export type PublicSupabaseAccountIntegration = {
  connectedAt: string;
};

export type PublicVercelAccountIntegration = {
  last4: string;
  connectedAt: string;
};

export type PublicUserIntegrations = {
  supabase?: PublicSupabaseAccountIntegration;
  vercel?: PublicVercelAccountIntegration;
};

export const toPublicUserIntegrations = (
  integrations: UserIntegrations | null | undefined,
): PublicUserIntegrations | null => {
  if (!integrations) return null;
  const out: PublicUserIntegrations = {};
  if (integrations.supabase) {
    out.supabase = { connectedAt: integrations.supabase.connectedAt };
  }
  if (integrations.vercel) {
    out.vercel = {
      last4: integrations.vercel.last4,
      connectedAt: integrations.vercel.connectedAt,
    };
  }
  return out;
};

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  displayName: varchar("display_name", { length: 120 }).notNull(),
  avatarUrl: text("avatar_url"),
  passwordHash: text("password_hash").notNull(),
  integrations: jsonb("integrations").$type<UserIntegrations>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
