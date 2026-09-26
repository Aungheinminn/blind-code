import { boolean, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export type SupabaseIntegration = {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
  databaseUrl?: string;
  projectRef?: string;
  connectedAt: string;
};

export type ProjectIntegrations = {
  supabase?: SupabaseIntegration;
};

export type AgentToolName = "create_supabase_project" | "attach_supabase_project";

export type AgentToolPermissions = Partial<Record<AgentToolName, boolean>>;

export const DEFAULT_AGENT_TOOL_PERMISSIONS: Record<AgentToolName, boolean> = {
  create_supabase_project: true,
  attach_supabase_project: true,
};

export const resolveAgentToolPermissions = (
  stored: AgentToolPermissions | null | undefined,
): Record<AgentToolName, boolean> => ({
  ...DEFAULT_AGENT_TOOL_PERMISSIONS,
  ...(stored ?? {}),
});

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
  agentToolPermissions: jsonb("agent_tool_permissions").$type<AgentToolPermissions>(),
  designTemplateId: uuid("design_template_id"),
  isArchived: boolean("is_archived").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
