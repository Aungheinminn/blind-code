import { fetchJson } from "./http";

export type Project = {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProjectPatch = Partial<{
  name: string;
  description: string | null;
  isArchived: boolean;
}>;

export const listProjects = () => fetchJson<Project[]>("/projects");

export const getProject = (id: string) => fetchJson<Project | null>(`/projects/${id}`);

export const createProject = (name: string) =>
  fetchJson<{ id: string; created: boolean } | Project>("/projects", {
    method: "POST",
    body: JSON.stringify({ name }),
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
};

export const getProjectHistory = (id: string) =>
  fetchJson<HistoryMessage[]>(`/projects/${id}/history`);

export const getProjectFiles = (id: string) =>
  fetchJson<Record<string, string>>(`/projects/${id}/files`);
