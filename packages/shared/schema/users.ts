import { integer, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export type SupabaseAccountIntegration = {
  accessToken: string;
  connectedAt: string;
};

export type VercelAccountIntegration = {
  apiToken: string;
  last4: string;
  connectedAt: string;
};

export type GitHubAccountIntegration = {
  accessToken: string;
  last4: string;
  login: string;
  githubUserId: number;
  avatarUrl?: string;
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
  github?: GitHubAccountIntegration;
  providers?: UserProviderKeys;
};

export type PublicSupabaseAccountIntegration = {
  connectedAt: string;
};

export type PublicVercelAccountIntegration = {
  last4: string;
  connectedAt: string;
};

export type PublicGitHubAccountIntegration = Omit<GitHubAccountIntegration, "accessToken">;

export type PublicUserIntegrations = {
  supabase?: PublicSupabaseAccountIntegration;
  vercel?: PublicVercelAccountIntegration;
  github?: PublicGitHubAccountIntegration;
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
  if (integrations.github) {
    const { accessToken: _drop, ...rest } = integrations.github;
    out.github = rest;
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
  creditsBalance: integer("credits_balance").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
