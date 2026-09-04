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
