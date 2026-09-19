const API_BASE = "https://api.supabase.com";

export type SupabaseProject = {
  id: string;
  organization_id: string;
  name: string;
  region: string;
  created_at: string;
  status?: string;
};

export type SupabaseApiKey = {
  name: string;
  api_key: string;
};

export class SupabaseManagementError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const managementFetch = async <T>(
  pat: string,
  path: string,
  init: RequestInit = {},
): Promise<T> => {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${pat}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    let msg = `Supabase Management API ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string; error?: string };
      if (typeof body?.message === "string") msg = body.message;
      else if (typeof body?.error === "string") msg = body.error;
    } catch {}
    throw new SupabaseManagementError(res.status, msg);
  }
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
};

export const listSupabaseProjects = (pat: string) =>
  managementFetch<SupabaseProject[]>(pat, "/v1/projects");

export const validatePat = async (pat: string): Promise<boolean> => {
  try {
    await listSupabaseProjects(pat);
    return true;
  } catch {
    return false;
  }
};

export const getSupabaseApiKeys = (pat: string, ref: string) =>
  managementFetch<SupabaseApiKey[]>(
    pat,
    `/v1/projects/${encodeURIComponent(ref)}/api-keys?reveal=true`,
  );

export const runSupabaseManagementQuery = (
  pat: string,
  ref: string,
  sql: string,
) =>
  managementFetch<unknown>(
    pat,
    `/v1/projects/${encodeURIComponent(ref)}/database/query`,
    {
      method: "POST",
      body: JSON.stringify({ query: sql }),
    },
  );
