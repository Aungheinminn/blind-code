const SERVER_HTTP = import.meta.env.VITE_SERVER_HTTP ?? "http://localhost:3001";

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

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(`${SERVER_HTTP}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const json = (await res.json()) as { data: T; warning?: string };
  if (json.warning) console.warn(`[api] ${path}: ${json.warning}`);
  return json.data;
};

export const listProjects = () => request<Project[]>("/projects");

export const getProject = (id: string) => request<Project | null>(`/projects/${id}`);

export const createProject = (name: string) =>
  request<{ id: string; created: boolean } | Project>("/projects", {
    method: "POST",
    body: JSON.stringify({ name }),
  });

export const updateProject = (id: string, patch: ProjectPatch) =>
  request<Project | null>(`/projects/${id}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });

export const deleteProject = (id: string) =>
  request<{ id: string; deleted: boolean }>(`/projects/${id}`, {
    method: "DELETE",
  });
