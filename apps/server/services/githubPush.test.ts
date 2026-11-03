import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { GitHubIntegration } from "@vibe/shared";

let project: {
  id: string;
  name: string;
  integrations: { github?: GitHubIntegration } | null;
};
let files: Array<{ path: string; content: string; isDirectory: boolean }>;

// bun's module mocks are process-wide, so keep the real exports for other test files.
const realRepo = await import("../db/repo");
mock.module("../db/repo", () => ({
  ...realRepo,
  getProjectForOwner: async () => project,
  listProjectFiles: async () => files,
  getActiveDesignTemplateForProject: async () => null,
  setGitHubIntegrationForOwner: async (_id: string, _owner: string, g: GitHubIntegration) => {
    project = { ...project, integrations: { ...(project.integrations ?? {}), github: g } };
    return project;
  },
  getUserById: async () => ({ integrations: { github: { accessToken: "tok" } } }),
}));

const { pushProjectToGitHub, GitHubPushError } = await import("./githubPush");

// Minimal in-memory GitHub: one branch, commits keyed by sha with a tree sha.
let branchHead: string | null;
let commits: Map<string, string>;
let seq: number;
let calls: string[];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
  const url = new URL(String(input));
  const method = init?.method ?? "GET";
  const path = url.pathname.replace("/repos/me/app", "");
  calls.push(`${method} ${path}`);
  if (method === "GET" && path === "/git/ref/heads/main") {
    return branchHead ? json({ object: { sha: branchHead } }) : json({ message: "Git Repository is empty." }, 409);
  }
  if (method === "PUT" && path === "/contents/.gitkeep") {
    branchHead = `c${seq++}`;
    commits.set(branchHead, "empty-tree");
    return json({ commit: { sha: branchHead } }, 201);
  }
  if (method === "POST" && path === "/git/trees") {
    const body = JSON.parse(String(init?.body));
    const key = body.tree.map((t: { path: string; content: string }) => `${t.path}=${t.content}`).sort().join("|");
    return json({ sha: `t:${Bun.hash(key)}` }, 201);
  }
  if (method === "GET" && path.startsWith("/git/commits/")) {
    return json({ tree: { sha: commits.get(path.split("/").pop()!) } });
  }
  if (method === "POST" && path === "/git/commits") {
    const body = JSON.parse(String(init?.body));
    const sha = `c${seq++}`;
    commits.set(sha, body.tree);
    return json({ sha, html_url: `https://github.com/me/app/commit/${sha}` }, 201);
  }
  if (method === "PATCH" && path.startsWith("/git/refs/heads/")) {
    if (path === "/git/refs/heads/main") branchHead = JSON.parse(String(init?.body)).sha;
    return json({});
  }
  if (method === "POST" && path === "/git/refs") {
    return json({}, 201);
  }
  throw new Error(`unexpected ${method} ${path}`);
}) as typeof fetch;

const linked = (extra: Partial<GitHubIntegration> = {}): GitHubIntegration => ({
  owner: "me",
  repo: "app",
  repoId: 1,
  branch: "main",
  htmlUrl: "https://github.com/me/app",
  private: true,
  linkedAt: "2026-01-01T00:00:00Z",
  ...extra,
});

const push = (opts: { force?: boolean; newBranch?: string } = {}) =>
  pushProjectToGitHub({ ownerId: "u1", projectId: "p1", message: "msg", ...opts });

beforeEach(() => {
  branchHead = null;
  commits = new Map();
  seq = 1;
  calls = [];
  files = [{ path: "/App.tsx", content: "v1", isDirectory: false }];
  project = { id: "p1", name: "Demo", integrations: { github: linked() } };
});

describe("pushProjectToGitHub", () => {
  test("seeds an empty repo and pushes", async () => {
    const res = await push();
    expect(res.status).toBe("pushed");
    expect(calls).toContain("PUT /contents/.gitkeep");
    expect(branchHead).toBe(res.commitSha);
    expect(project.integrations?.github?.lastPushedSha).toBe(res.commitSha);
  });

  test("second push with no changes is a no-op", async () => {
    const first = await push();
    const second = await push();
    expect(second.status).toBe("noop");
    expect(second.commitSha).toBe(first.commitSha);
  });

  test("pushes again after files change", async () => {
    const first = await push();
    files = [{ path: "/App.tsx", content: "v2", isDirectory: false }];
    const second = await push();
    expect(second.status).toBe("pushed");
    expect(second.commitSha).not.toBe(first.commitSha);
  });

  test("refuses to overwrite a non-empty repo it never pushed to", async () => {
    branchHead = "external";
    commits.set("external", "other-tree");
    const err = await push().catch((e) => e);
    expect(err).toBeInstanceOf(GitHubPushError);
    expect(err.code).toBe("diverged");
    expect(err.remoteSha).toBe("external");
    expect(branchHead).toBe("external");
  });

  test("detects commits made outside Blind Code", async () => {
    await push();
    branchHead = "outside";
    commits.set("outside", "other-tree");
    files = [{ path: "/App.tsx", content: "v2", isDirectory: false }];
    const err = await push().catch((e) => e);
    expect(err.code).toBe("diverged");
  });

  test("force builds on the remote head instead of discarding it", async () => {
    branchHead = "external";
    commits.set("external", "other-tree");
    const res = await push({ force: true });
    expect(res.status).toBe("pushed");
    expect(branchHead).toBe(res.commitSha);
    expect(calls).toContain("GET /git/commits/external");
  });

  test("newBranch skips the divergence check and switches branch", async () => {
    branchHead = "external";
    commits.set("external", "other-tree");
    const res = await push({ newBranch: "blind-code" });
    expect(res.branch).toBe("blind-code");
    expect(calls).toContain("POST /git/refs");
    expect(calls).toContain("PATCH /git/refs/heads/blind-code");
    expect(branchHead).toBe("external");
    expect(project.integrations?.github?.branch).toBe("blind-code");
  });

  test("errors when no repo is linked", async () => {
    project = { ...project, integrations: null };
    const err = await push().catch((e) => e);
    expect(err.code).toBe("not_linked");
  });
});
