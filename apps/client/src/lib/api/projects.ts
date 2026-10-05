import { fetchJson } from "./http";

export type PublicSupabaseIntegration = {
  url: string;
  anonKey: string;
  hasServiceRoleKey: boolean;
  hasDatabaseUrl: boolean;
  projectRef?: string;
  connectedAt: string;
};

export type PublicVercelIntegration = {
  projectId: string;
  projectName: string;
  productionUrl?: string;
  lastDeploymentUrl?: string;
  lastDeploymentId?: string;
  lastDeployedAt?: string;
};

export type PublicProjectIntegrations = {
  supabase?: PublicSupabaseIntegration;
  vercel?: PublicVercelIntegration;
};

export type AgentToolName = "create_supabase_project" | "attach_supabase_project";
export type AgentToolPermissions = Partial<Record<AgentToolName, boolean>>;

export type Project = {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  isArchived: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  integrations?: PublicProjectIntegrations | null;
  agentToolPermissions?: AgentToolPermissions | null;
};

export type ProjectListFilter = "active" | "archived" | "deleted";

export type ProjectPatch = Partial<{
  name: string;
  description: string | null;
  isArchived: boolean;
  agentToolPermissions: AgentToolPermissions | null;
}>;

export type ProjectListPage = {
  items: Project[];
  total: number;
  page: number;
  pageSize: number;
};

export type ProjectListQuery = {
  q?: string;
  page?: number;
  pageSize?: number;
  filter?: ProjectListFilter;
};

export const listProjects = (opts: ProjectListQuery = {}) => {
  const params = new URLSearchParams();
  if (opts.q && opts.q.trim()) params.set("q", opts.q.trim());
  if (opts.page && opts.page > 1) params.set("page", String(opts.page));
  if (opts.pageSize) params.set("pageSize", String(opts.pageSize));
  if (opts.filter && opts.filter !== "active") params.set("filter", opts.filter);
  const qs = params.toString();
  return fetchJson<ProjectListPage>(`/projects${qs ? `?${qs}` : ""}`);
};

export const getProject = (id: string) => fetchJson<Project | null>(`/projects/${id}`);

export const createProject = (input: string | { name: string; description?: string | null }) => {
  const body = typeof input === "string" ? { name: input } : input;
  return fetchJson<{ id: string; created: boolean } | Project>("/projects", {
    method: "POST",
    body: JSON.stringify(body),
  });
};

export type CreatedProjectFromPrompt = {
  id: string;
  created: boolean;
  name: string;
  description: string;
  title: string;
};

export const createProjectFromPrompt = (input: {
  prompt: string;
  model: string;
  name?: string;
  description?: string;
}) =>
  fetchJson<CreatedProjectFromPrompt>("/projects/from-prompt", {
    method: "POST",
    body: JSON.stringify(input),
  });

export const updateProject = (id: string, patch: ProjectPatch) =>
  fetchJson<Project | null>(`/projects/${id}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });

export const deleteProject = (id: string) =>
  fetchJson<{ id: string; deleted: boolean }>(`/projects/${id}`, {
    method: "DELETE",
  });

export const restoreProject = (id: string) =>
  fetchJson<Project>(`/projects/${id}/restore`, {
    method: "POST",
  });

export const hardDeleteProject = (id: string) =>
  fetchJson<{ id: string; deleted: boolean }>(`/projects/${id}/permanent`, {
    method: "DELETE",
  });

export type HistoryPart =
  | { kind: "text"; text: string }
  | { kind: "tool"; id: string; name: string; input: unknown; output?: unknown };

export type HistoryUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type HistoryMessage = {
  id: string;
  role: "user" | "agent";
  content: string;
  parts?: HistoryPart[];
  timestamp: string;
  interrupted?: boolean;
  usage?: HistoryUsage;
};

export type HistoryPlanTodoStatus = "pending" | "active" | "done" | "skipped";

export type HistoryPlanSnapshot = {
  id: string;
  summary: string;
  todos: Array<{
    id: string;
    title: string;
    rationale: string;
    status: HistoryPlanTodoStatus;
    note: string | null;
  }>;
};

export type HistoryResponse = {
  messages: HistoryMessage[];
  latestPlan: HistoryPlanSnapshot | null;
};

export const getProjectHistory = (id: string) =>
  fetchJson<HistoryResponse>(`/projects/${id}/history`);

export const getProjectFiles = (id: string) =>
  fetchJson<Record<string, string>>(`/projects/${id}/files`);

export type ProjectDesignTemplate = {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  origin: "builtin" | "user" | "agent";
  css: string;
  tokens: Record<string, unknown>;
};

export type DesignTemplateSummary = {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  origin: "builtin" | "user" | "agent";
  parsedTokens: {
    colors?: Record<string, string>;
    [k: string]: unknown;
  } | null;
  isReadOnly: boolean;
  isArchived?: boolean;
  deletedAt?: string | null;
  sortOrder: number;
  updatedAt: string;
};

export type DesignTemplateListFilter = "active" | "archived" | "deleted";

export type DesignTemplateFull = DesignTemplateSummary & {
  content: string;
  ownerUserId: string | null;
  sourceProjectId: string | null;
  createdAt: string;
};

export const listDesignTemplates = (
  opts: { filter?: DesignTemplateListFilter } = {},
) => {
  const qs =
    opts.filter && opts.filter !== "active" ? `?filter=${opts.filter}` : "";
  return fetchJson<DesignTemplateSummary[]>(`/design-templates${qs}`);
};

export const getDesignTemplate = (id: string) =>
  fetchJson<DesignTemplateFull>(`/design-templates/${id}`);

export const createDesignTemplateFromDraft = (input: {
  markdown: string;
  name?: string;
  description?: string;
}) =>
  fetchJson<{ id: string; slug: string | null; name: string }>(
    `/design-templates`,
    { method: "POST", body: JSON.stringify(input) },
  );

export const updateDesignTemplateFromDraft = (
  id: string,
  input: { markdown: string; name?: string; description?: string },
) =>
  fetchJson<DesignTemplateFull>(`/design-templates/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });

export const deleteDesignTemplate = (id: string) =>
  fetchJson<{ id: string; deleted: boolean }>(`/design-templates/${id}`, {
    method: "DELETE",
  });

export const restoreDesignTemplate = (id: string) =>
  fetchJson<{ id: string; restored: boolean }>(
    `/design-templates/${id}/restore`,
    { method: "POST" },
  );

export const hardDeleteDesignTemplate = (id: string) =>
  fetchJson<{ id: string; deleted: boolean }>(
    `/design-templates/${id}/permanent`,
    { method: "DELETE" },
  );

export const setDesignTemplateArchived = (id: string, isArchived: boolean) =>
  fetchJson<{ id: string; isArchived: boolean }>(
    `/design-templates/${id}/archive`,
    {
      method: "PATCH",
      body: JSON.stringify({ isArchived }),
    },
  );

export const getProjectDesignTemplate = (id: string) =>
  fetchJson<ProjectDesignTemplate>(`/projects/${id}/design-template`);

export const setProjectDesignTemplate = (
  id: string,
  designTemplateId: string | null,
) =>
  fetchJson<{ id: string; designTemplateId: string | null }>(
    `/projects/${id}/design-template`,
    {
      method: "PUT",
      body: JSON.stringify({ designTemplateId }),
    },
  );

export type ConnectSupabaseInput = {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
  databaseUrl?: string;
};

export const connectSupabase = (id: string, input: ConnectSupabaseInput) =>
  fetchJson<Project>(`/projects/${id}/integrations/supabase`, {
    method: "PUT",
    body: JSON.stringify(input),
  });

export const disconnectSupabase = (id: string) =>
  fetchJson<Project>(`/projects/${id}/integrations/supabase`, {
    method: "DELETE",
  });

export const attachSupabaseProject = (id: string, projectRef: string) =>
  fetchJson<Project>(`/projects/${id}/integrations/supabase/attach`, {
    method: "POST",
    body: JSON.stringify({ projectRef }),
  });

export const listAttachedSupabaseRefs = () =>
  fetchJson<string[]>(`/projects/integrations/supabase/attached-refs`);

export type DeployProgress =
  | {
      status: "deploying";
      projectName: string;
      startedAt: number;
      deploymentId?: string;
    }
  | {
      status: "ready";
      projectName: string;
      startedAt: number;
      finishedAt: number;
      deploymentId: string;
      url: string;
      deploymentUrl: string;
    }
  | {
      status: "error";
      projectName: string;
      startedAt: number;
      finishedAt: number;
      error: string;
    };

export type VercelDeployStatus = {
  active: DeployProgress | null;
  integration: PublicVercelIntegration | null;
};

export const startVercelDeploy = (id: string) =>
  fetchJson<{ active: DeployProgress }>(`/projects/${id}/deploy/vercel`, {
    method: "POST",
  });

export const checkVercelDeploymentStatus = (id: string) =>
  fetchJson<VercelDeployStatus>(`/projects/${id}/deploy/vercel/status`);
