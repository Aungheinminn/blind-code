import { fetchJson } from "./http";

export type PublicSupabaseIntegration = {
  url: string;
  anonKey: string;
  hasServiceRoleKey: boolean;
  hasDatabaseUrl: boolean;
  connectedAt: string;
};

export type PublicProjectIntegrations = {
  supabase?: PublicSupabaseIntegration;
};

export type Project = {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  integrations?: PublicProjectIntegrations | null;
};

export type ProjectPatch = Partial<{
  name: string;
  description: string | null;
  isArchived: boolean;
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
};

export const listProjects = (opts: ProjectListQuery = {}) => {
  const params = new URLSearchParams();
  if (opts.q && opts.q.trim()) params.set("q", opts.q.trim());
  if (opts.page && opts.page > 1) params.set("page", String(opts.page));
  if (opts.pageSize) params.set("pageSize", String(opts.pageSize));
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
  provider: string;
  model?: string;
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

export type HistoryPart =
  | { kind: "text"; text: string }
  | { kind: "reasoning"; text: string }
  | { kind: "tool"; id: string; name: string; input: unknown; output?: unknown };

export type HistoryMessage = {
  id: string;
  role: "user" | "agent";
  content: string;
  parts?: HistoryPart[];
  timestamp: string;
  interrupted?: boolean;
};

export const getProjectHistory = (id: string) =>
  fetchJson<HistoryMessage[]>(`/projects/${id}/history`);

export const getProjectFiles = (id: string) =>
  fetchJson<Record<string, string>>(`/projects/${id}/files`);

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
