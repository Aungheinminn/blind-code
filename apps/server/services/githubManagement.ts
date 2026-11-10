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

export type GitHubRepo = {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  private: boolean;
  html_url: string;
  default_branch: string;
  pushed_at?: string | null;
  permissions?: { push?: boolean; admin?: boolean };
};

export const listRepos = (token: string) =>
  githubFetch<GitHubRepo[]>(
    token,
    "/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator,organization_member",
  );

export const getRepo = (token: string, owner: string, repo: string) =>
  githubFetch<GitHubRepo>(
    token,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
  );

export type CreateRepoInput = {
  name: string;
  private?: boolean;
  description?: string;
};

// auto_init gives the repo a first commit so the Git Data API (which 409s
// on empty repositories) works on the very first push.
export const createRepo = (token: string, input: CreateRepoInput) =>
  githubFetch<GitHubRepo>(token, "/user/repos", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      private: input.private ?? true,
      description: input.description,
      auto_init: true,
    }),
  });

const repoPath = (owner: string, repo: string) =>
  `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

export const getBranchHead = async (
  token: string,
  owner: string,
  repo: string,
  branch: string,
): Promise<string | null> => {
  try {
    const ref = await githubFetch<{ object: { sha: string } }>(
      token,
      `${repoPath(owner, repo)}/git/ref/heads/${encodeURIComponent(branch)}`,
    );
    return ref.object.sha;
  } catch (err) {
    // 404: branch missing. 409: repository has no commits at all.
    if (
      err instanceof GitHubManagementError &&
      (err.status === 404 || err.status === 409)
    ) {
      return null;
    }
    throw err;
  }
};

export const getCommitTreeSha = async (
  token: string,
  owner: string,
  repo: string,
  commitSha: string,
): Promise<string> => {
  const commit = await githubFetch<{ tree: { sha: string } }>(
    token,
    `${repoPath(owner, repo)}/git/commits/${commitSha}`,
  );
  return commit.tree.sha;
};

export type TreeEntry = {
  path: string;
  mode: "100644";
  type: "blob";
  content: string;
};

export const createTree = async (
  token: string,
  owner: string,
  repo: string,
  tree: TreeEntry[],
): Promise<string> => {
  const created = await githubFetch<{ sha: string }>(
    token,
    `${repoPath(owner, repo)}/git/trees`,
    { method: "POST", body: JSON.stringify({ tree }) },
  );
  return created.sha;
};

export const createCommit = async (
  token: string,
  owner: string,
  repo: string,
  input: { message: string; tree: string; parents: string[] },
): Promise<{ sha: string; html_url: string }> =>
  githubFetch(token, `${repoPath(owner, repo)}/git/commits`, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const updateBranchRef = (
  token: string,
  owner: string,
  repo: string,
  branch: string,
  sha: string,
) =>
  githubFetch<unknown>(
    token,
    `${repoPath(owner, repo)}/git/refs/heads/${encodeURIComponent(branch)}`,
    { method: "PATCH", body: JSON.stringify({ sha, force: false }) },
  );

export const createBranchRef = (
  token: string,
  owner: string,
  repo: string,
  branch: string,
  sha: string,
) =>
  githubFetch<unknown>(token, `${repoPath(owner, repo)}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }),
  });

// Seeds an empty repository so the Git Data API has a commit to build on.
export const seedEmptyRepo = async (
  token: string,
  owner: string,
  repo: string,
  branch: string,
): Promise<string> => {
  const res = await githubFetch<{ commit: { sha: string } }>(
    token,
    `${repoPath(owner, repo)}/contents/.gitkeep`,
    {
      method: "PUT",
      body: JSON.stringify({ message: "Initial commit", content: "", branch }),
    },
  );
  return res.commit.sha;
};

export type GitTreeItem = {
  path: string;
  type: "blob" | "tree" | "commit";
  sha: string;
  size?: number;
};

export const getTreeRecursive = (token: string, owner: string, repo: string, sha: string) =>
  githubFetch<{ tree: GitTreeItem[]; truncated: boolean }>(
    token,
    `${repoPath(owner, repo)}/git/trees/${sha}?recursive=1`,
  );

export const getBlobBase64 = async (
  token: string,
  owner: string,
  repo: string,
  sha: string,
): Promise<string> => {
  const blob = await githubFetch<{ content: string; encoding: string }>(
    token,
    `${repoPath(owner, repo)}/git/blobs/${sha}`,
  );
  return blob.content.replace(/\n/g, "");
};
