import { boolean, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export type SupabaseIntegration = {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
  databaseUrl?: string;
  projectRef?: string;
  connectedAt: string;
};

export type VercelIntegration = {
  projectId: string;
  projectName: string;
  productionUrl?: string;
  lastDeploymentUrl?: string;
  lastDeploymentId?: string;
  lastDeployedAt?: string;
};

export type GitHubIntegration = {
  owner: string;
  repo: string;
  repoId: number;
  branch: string;
  htmlUrl: string;
  private: boolean;
  linkedAt: string;
  lastPushedSha?: string;
  lastPushedAt?: string;
  // sha256 of the exported file set, so the UI can flag unpushed changes
  // without a GitHub round-trip.
  lastPushedContentHash?: string;
};

export type ProjectIntegrations = {
  supabase?: SupabaseIntegration;
  vercel?: VercelIntegration;
  github?: GitHubIntegration;
};

export type AgentToolName =
  | "create_supabase_project"
  | "attach_supabase_project"
  | "github_create_repo"
  | "github_push";

export type AgentToolPermissions = Partial<Record<AgentToolName, boolean>>;

export const DEFAULT_AGENT_TOOL_PERMISSIONS: Record<AgentToolName, boolean> = {
  create_supabase_project: true,
  attach_supabase_project: true,
  // GitHub tools publish code outside Blind Code, so they're opt-in per project.
  github_create_repo: false,
  github_push: false,
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
  vercel?: VercelIntegration;
  github?: GitHubIntegration;
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
  if (integrations.vercel) {
    out.vercel = integrations.vercel;
  }
  if (integrations.github) {
    out.github = integrations.github;
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
  // Rolling summary of chat turns that no longer fit the model's window.
  // contextSummaryCovers counts how many leading history messages it covers.
  contextSummary: text("context_summary"),
  contextSummaryCovers: integer("context_summary_covers").default(0).notNull(),
  isArchived: boolean("is_archived").default(false).notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
