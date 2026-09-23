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

export type SupabaseOrganization = {
  id: string;
  name: string;
  slug?: string;
};

export type CreateSupabaseProjectInput = {
  name: string;
  organizationSlug: string;
  dbPass: string;
  regionCode: string;
};

export type CreatedSupabaseProject = {
  id: string;
  name: string;
  organization_id: string;
  region: string;
  status?: string;
  created_at: string;
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

export const listSupabaseOrganizations = (pat: string) =>
  managementFetch<SupabaseOrganization[]>(pat, "/v1/organizations");

export const createSupabaseProject = (
  pat: string,
  input: CreateSupabaseProjectInput,
) =>
  managementFetch<CreatedSupabaseProject>(pat, "/v1/projects", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      organization_slug: input.organizationSlug,
      db_pass: input.dbPass,
      region_selection: { type: "smartGroup", code: input.regionCode },
    }),
  });

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

export const deleteSupabaseProject = (pat: string, ref: string) =>
  managementFetch<unknown>(pat, `/v1/projects/${encodeURIComponent(ref)}`, {
    method: "DELETE",
  });

export const getSupabaseProject = (pat: string, ref: string) =>
  managementFetch<SupabaseProject>(
    pat,
    `/v1/projects/${encodeURIComponent(ref)}`,
  );

export type WaitForSupabaseProjectReadyOptions = {
  timeoutMs?: number;
  pollMs?: number;
  signal?: AbortSignal;
};

export const waitForSupabaseProjectReady = async (
  pat: string,
  ref: string,
  opts: WaitForSupabaseProjectReadyOptions = {},
): Promise<SupabaseProject> => {
  const timeoutMs = opts.timeoutMs ?? 180_000;
  const pollMs = opts.pollMs ?? 3_000;
  const deadline = Date.now() + timeoutMs;
  let last: SupabaseProject | null = null;
  while (Date.now() < deadline) {
    if (opts.signal?.aborted) {
      throw new SupabaseManagementError(499, "wait aborted");
    }
    try {
      last = await getSupabaseProject(pat, ref);
      if (last.status === "ACTIVE_HEALTHY") return last;
    } catch (err) {
      if (err instanceof SupabaseManagementError && err.status !== 404) throw err;
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new SupabaseManagementError(
    504,
    `Supabase project ${ref} did not become ACTIVE_HEALTHY within ${Math.round(timeoutMs / 1000)}s (last status: ${last?.status ?? "unknown"})`,
  );
};
