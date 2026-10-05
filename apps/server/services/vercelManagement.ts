const API_BASE = "https://api.vercel.com";

export class VercelManagementError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const resolveTokenOrEnv = (override?: string | null): string => {
  if (override) return override;
  const t = process.env.VERCEL_API_TOKEN;
  if (!t) {
    throw new VercelManagementError(
      503,
      "VERCEL_API_TOKEN is not configured on the server",
    );
  }
  return t;
};

const vercelFetch = async <T>(
  path: string,
  init: RequestInit = {},
  teamId?: string,
  tokenOverride?: string | null,
): Promise<T> => {
  const url = new URL(`${API_BASE}${path}`);
  if (teamId) url.searchParams.set("teamId", teamId);
  const res = await fetch(url.toString(), {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${resolveTokenOrEnv(tokenOverride)}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    let msg = `Vercel API ${res.status}`;
    try {
      const body = (await res.json()) as {
        error?: { message?: string; code?: string } | string;
        message?: string;
      };
      if (typeof body?.error === "object" && body.error?.message) {
        msg = body.error.message;
      } else if (typeof body?.error === "string") {
        msg = body.error;
      } else if (typeof body?.message === "string") {
        msg = body.message;
      }
    } catch {}
    throw new VercelManagementError(res.status, msg);
  }
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
};

// Only honored when the Vercel API call runs against the platform token.
// User tokens target the user's own personal/team scope and should not inherit
// the server-side team hint.
const platformTeamId = (tokenOverride?: string | null): string | undefined =>
  tokenOverride ? undefined : process.env.VERCEL_TEAM_ID || undefined;

export type VercelProject = {
  id: string;
  name: string;
  framework?: string | null;
  accountId?: string;
};

export type CreateVercelProjectInput = {
  name: string;
  framework?: string;
};

export const validateToken = async (token?: string | null): Promise<boolean> => {
  try {
    await vercelFetch("/v2/user", {}, undefined, token);
    return true;
  } catch {
    return false;
  }
};

export const getProjectByName = async (
  name: string,
  token?: string | null,
): Promise<VercelProject | null> => {
  try {
    return await vercelFetch<VercelProject>(
      `/v9/projects/${encodeURIComponent(name)}`,
      {},
      platformTeamId(token),
      token,
    );
  } catch (err) {
    if (err instanceof VercelManagementError && err.status === 404) return null;
    throw err;
  }
};

export const getProjectById = async (
  id: string,
  token?: string | null,
): Promise<VercelProject | null> => {
  try {
    return await vercelFetch<VercelProject>(
      `/v9/projects/${encodeURIComponent(id)}`,
      {},
      platformTeamId(token),
      token,
    );
  } catch (err) {
    if (err instanceof VercelManagementError && err.status === 404) return null;
    throw err;
  }
};

export const createProject = (
  input: CreateVercelProjectInput,
  token?: string | null,
) =>
  vercelFetch<VercelProject>(
    "/v10/projects",
    {
      method: "POST",
      body: JSON.stringify({
        name: input.name,
        framework: input.framework ?? "vite",
      }),
    },
    platformTeamId(token),
    token,
  );

export const deleteProject = (idOrName: string, token?: string | null) =>
  vercelFetch<unknown>(
    `/v9/projects/${encodeURIComponent(idOrName)}`,
    { method: "DELETE" },
    platformTeamId(token),
    token,
  );

export type VercelEnvTarget = "production" | "preview" | "development";

export type UpsertEnvInput = {
  key: string;
  value: string;
  target?: VercelEnvTarget[];
  type?: "encrypted" | "plain" | "sensitive";
};

export const upsertProjectEnv = (
  projectId: string,
  envs: UpsertEnvInput[],
  token?: string | null,
) =>
  vercelFetch<unknown>(
    `/v10/projects/${encodeURIComponent(projectId)}/env?upsert=true`,
    {
      method: "POST",
      body: JSON.stringify(
        envs.map((e) => ({
          key: e.key,
          value: e.value,
          target: e.target ?? ["production", "preview", "development"],
          type: e.type ?? "encrypted",
        })),
      ),
    },
    platformTeamId(token),
    token,
  );

export type DeploymentFile = {
  file: string;
  data: string;
  encoding?: "utf-8" | "base64";
};

export type CreateDeploymentInput = {
  name: string;
  project: string;
  files: DeploymentFile[];
  target?: "production" | "staging";
  framework?: string;
};

export type DeploymentResponse = {
  id: string;
  url?: string;
  readyState:
    | "QUEUED"
    | "INITIALIZING"
    | "BUILDING"
    | "READY"
    | "ERROR"
    | "CANCELED"
    | "BLOCKED";
  alias?: string[];
  errorCode?: string;
  errorMessage?: string;
};

export const createDeployment = (
  input: CreateDeploymentInput,
  token?: string | null,
) =>
  vercelFetch<DeploymentResponse>(
    "/v13/deployments?skipAutoDetectionConfirmation=1",
    {
      method: "POST",
      body: JSON.stringify({
        name: input.name,
        project: input.project,
        target: input.target ?? "production",
        files: input.files.map((f) => ({
          file: f.file.replace(/^\/+/, ""),
          data: f.data,
          encoding: f.encoding ?? "utf-8",
        })),
        projectSettings: {
          framework: input.framework ?? "vite",
        },
      }),
    },
    platformTeamId(token),
    token,
  );

export const getDeployment = (id: string, token?: string | null) =>
  vercelFetch<DeploymentResponse>(
    `/v13/deployments/${encodeURIComponent(id)}`,
    {},
    platformTeamId(token),
    token,
  );

export type WaitForDeploymentOptions = {
  timeoutMs?: number;
  pollMs?: number;
  signal?: AbortSignal;
  onState?: (state: DeploymentResponse) => void;
  token?: string | null;
};

export const waitForDeploymentReady = async (
  id: string,
  opts: WaitForDeploymentOptions = {},
): Promise<DeploymentResponse> => {
  const timeoutMs = opts.timeoutMs ?? 240_000;
  const pollMs = opts.pollMs ?? 3_000;
  const deadline = Date.now() + timeoutMs;
  let last: DeploymentResponse | null = null;
  while (Date.now() < deadline) {
    if (opts.signal?.aborted) {
      throw new VercelManagementError(499, "wait aborted");
    }
    last = await getDeployment(id, opts.token ?? null);
    opts.onState?.(last);
    if (last.readyState === "READY") return last;
    if (
      last.readyState === "ERROR" ||
      last.readyState === "CANCELED" ||
      last.readyState === "BLOCKED"
    ) {
      throw new VercelManagementError(
        502,
        last.errorMessage ||
          `Deployment ${id} ended in state ${last.readyState}`,
      );
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new VercelManagementError(
    504,
    `Deployment ${id} did not become READY within ${Math.round(
      timeoutMs / 1000,
    )}s (last state: ${last?.readyState ?? "unknown"})`,
  );
};
