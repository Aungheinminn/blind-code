const API_BASE = "https://api.github.com";

export class GitHubManagementError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const githubFetch = async <T>(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<T> => {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    let msg = `GitHub API ${res.status}`;
    try {
      const body = (await res.json()) as {
        message?: string;
        errors?: Array<{ message?: string }>;
      };
      if (body?.message) msg = body.message;
      const detail = body?.errors?.find((e) => e.message)?.message;
      if (detail) msg = `${msg}: ${detail}`;
    } catch {}
    if (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0") {
      msg = "GitHub rate limit exceeded — try again in a few minutes";
    }
    throw new GitHubManagementError(res.status, msg);
  }
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
};

export type GitHubViewer = {
  id: number;
  login: string;
  avatar_url?: string;
};

export const getViewer = (token: string) =>
  githubFetch<GitHubViewer>(token, "/user");
