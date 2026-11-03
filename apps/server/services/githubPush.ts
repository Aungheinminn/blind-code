import { createHash } from "crypto";
import type { DesignTemplateFrontmatter, GitHubIntegration } from "@vibe/shared";
import {
  getActiveDesignTemplateForProject,
  getProjectForOwner,
  listProjectFiles,
  setGitHubIntegrationForOwner,
} from "../db/repo";
import { templateToCss } from "./designTemplate";
import { assembleGitHubProject } from "./vercelAssembler";
import { resolveGitHubToken } from "./githubToken";
import {
  createBranchRef,
  createCommit,
  createRepo,
  createTree,
  getBranchHead,
  getCommitTreeSha,
  getRepo,
  GitHubManagementError,
  seedEmptyRepo,
  updateBranchRef,
  type GitHubRepo,
} from "./githubManagement";

export type GitHubPushErrorCode =
  | "not_found"
  | "not_connected"
  | "not_linked"
  | "busy"
  | "diverged"
  | "repo_unavailable"
  | "invalid";

export class GitHubPushError extends Error {
  code: GitHubPushErrorCode;
  remoteSha?: string;
  constructor(code: GitHubPushErrorCode, message: string, remoteSha?: string) {
    super(message);
    this.code = code;
    this.remoteSha = remoteSha;
  }
}

export const githubPushErrorStatus = (code: GitHubPushErrorCode): number => {
  switch (code) {
    case "not_found":
      return 404;
    case "busy":
    case "diverged":
      return 409;
    case "repo_unavailable":
      return 502;
    default:
      return 400;
  }
};

const BRANCH_RE = /^(?!\/)(?!.*\.\.)(?!.*\/\/)[A-Za-z0-9._\/-]{1,200}(?<![\/.])$/;
const REPO_NAME_RE = /^[A-Za-z0-9._-]{1,100}$/;

export const isValidBranchName = (b: string) => BRANCH_RE.test(b);
export const isValidRepoName = (n: string) => REPO_NAME_RE.test(n);

export const contentHashOf = (files: Record<string, string>): string => {
  const h = createHash("sha256");
  for (const path of Object.keys(files).sort()) {
    h.update(path).update("\0").update(files[path]).update("\0");
  }
  return h.digest("hex");
};

const loadOwnedProject = async (projectId: string, ownerId: string) => {
  const project = await getProjectForOwner(projectId, ownerId);
  if (!project) throw new GitHubPushError("not_found", "Project not found");
  return project;
};

const requireToken = async (ownerId: string): Promise<string> => {
  const token = await resolveGitHubToken(ownerId);
  if (!token) {
    throw new GitHubPushError(
      "not_connected",
      "GitHub account not connected. Connect it at /settings/github.",
    );
  }
  return token;
};

export const buildGitHubExport = async (
  project: Awaited<ReturnType<typeof loadOwnedProject>>,
  ownerId: string,
): Promise<Record<string, string>> => {
  const [fileRows, designTemplate] = await Promise.all([
    listProjectFiles(project.id),
    getActiveDesignTemplateForProject(project.id, ownerId),
  ]);
  const raw: Record<string, string> = {};
  for (const f of fileRows) {
    if (f.isDirectory) continue;
    raw[f.path] = f.content;
  }
  const designCss = designTemplate
    ? templateToCss((designTemplate.parsedTokens ?? {}) as DesignTemplateFrontmatter)
    : null;
  const supabase = project.integrations?.supabase;
  return assembleGitHubProject(raw, {
    projectName: project.name,
    supabase:
      supabase?.url && supabase?.anonKey
        ? { url: supabase.url, anonKey: supabase.anonKey }
        : null,
    designCss,
  });
};

const wrapGitHubError = (err: unknown): never => {
  if (err instanceof GitHubPushError) throw err;
  if (err instanceof GitHubManagementError) {
    if (err.status === 404 || err.status === 403) {
      throw new GitHubPushError(
        "repo_unavailable",
        `GitHub: ${err.message}. Check the repo still exists and your token has Contents: read/write access to it.`,
      );
    }
    throw new GitHubPushError("repo_unavailable", `GitHub: ${err.message}`);
  }
  throw err;
};

const integrationFromRepo = (
  repo: GitHubRepo,
  branch: string,
  lastPushedSha?: string,
): GitHubIntegration => ({
  owner: repo.owner.login,
  repo: repo.name,
  repoId: repo.id,
  branch,
  htmlUrl: repo.html_url,
  private: repo.private,
  linkedAt: new Date().toISOString(),
  ...(lastPushedSha ? { lastPushedSha } : {}),
});

export const createRepoForProject = async (args: {
  ownerId: string;
  projectId: string;
  name: string;
  private?: boolean;
  description?: string;
}): Promise<GitHubIntegration> => {
  const project = await loadOwnedProject(args.projectId, args.ownerId);
  if (!isValidRepoName(args.name)) {
    throw new GitHubPushError(
      "invalid",
      "Repo name may only contain letters, numbers, '.', '-' and '_'.",
    );
  }
  const token = await requireToken(args.ownerId);
  try {
    const repo = await createRepo(token, {
      name: args.name,
      private: args.private ?? true,
      description: args.description,
    });
    // Record the auto_init commit as our sync point so the first push
    // doesn't trip the "remote changed outside Blind Code" check.
    const head = await getBranchHead(token, repo.owner.login, repo.name, repo.default_branch);
    const integration = integrationFromRepo(repo, repo.default_branch, head ?? undefined);
    await setGitHubIntegrationForOwner(project.id, args.ownerId, integration);
    return integration;
  } catch (err) {
    if (err instanceof GitHubManagementError && err.status === 422) {
      throw new GitHubPushError(
        "invalid",
        `A repo named '${args.name}' already exists on your account. Pick another name or link it instead.`,
      );
    }
    return wrapGitHubError(err);
  }
};

export const linkRepoToProject = async (args: {
  ownerId: string;
  projectId: string;
  fullName: string;
  branch?: string;
}): Promise<GitHubIntegration> => {
  const project = await loadOwnedProject(args.projectId, args.ownerId);
  const [owner, repoName, ...extra] = args.fullName.split("/");
  if (!owner || !repoName || extra.length) {
    throw new GitHubPushError("invalid", "Repo must be in 'owner/name' form.");
  }
  if (args.branch && !isValidBranchName(args.branch)) {
    throw new GitHubPushError("invalid", "Invalid branch name.");
  }
  const token = await requireToken(args.ownerId);
  try {
    const repo = await getRepo(token, owner, repoName);
    if (repo.permissions && repo.permissions.push === false) {
      throw new GitHubPushError(
        "invalid",
        `You don't have push access to ${repo.full_name}.`,
      );
    }
    const integration = integrationFromRepo(repo, args.branch || repo.default_branch);
    await setGitHubIntegrationForOwner(project.id, args.ownerId, integration);
    return integration;
  } catch (err) {
    return wrapGitHubError(err);
  }
};

export type GitHubPushResult = {
  status: "pushed" | "noop";
  branch: string;
  commitSha: string;
  commitUrl: string;
  integration: GitHubIntegration;
};

const inFlight = new Set<string>();

export const pushProjectToGitHub = async (args: {
  ownerId: string;
  projectId: string;
  message?: string;
  force?: boolean;
  newBranch?: string;
}): Promise<GitHubPushResult> => {
  const project = await loadOwnedProject(args.projectId, args.ownerId);
  const linked = project.integrations?.github;
  if (!linked) {
    throw new GitHubPushError(
      "not_linked",
      "No GitHub repo is linked to this project yet.",
    );
  }
  if (args.newBranch && !isValidBranchName(args.newBranch)) {
    throw new GitHubPushError("invalid", "Invalid branch name.");
  }
  const token = await requireToken(args.ownerId);

  if (inFlight.has(project.id)) {
    throw new GitHubPushError("busy", "A push for this project is already in progress.");
  }
  inFlight.add(project.id);
  try {
    const { owner, repo } = linked;
    const files = await buildGitHubExport(project, args.ownerId);
    const contentHash = contentHashOf(files);

    let head = await getBranchHead(token, owner, repo, linked.branch);
    let seeded = false;
    if (!head) {
      head = await seedEmptyRepo(token, owner, repo, linked.branch);
      seeded = true;
    }

    let branch = linked.branch;
    if (args.newBranch) {
      await createBranchRef(token, owner, repo, args.newBranch, head);
      branch = args.newBranch;
    } else if (!seeded && !args.force && linked.lastPushedSha !== head) {
      throw new GitHubPushError(
        "diverged",
        linked.lastPushedSha
          ? `${owner}/${repo}@${branch} has commits that weren't made from Blind Code. Push to a new branch, or replace the files on it (remote history is kept).`
          : `${owner}/${repo}@${branch} already has content. Push to a new branch, or replace its files with this project (history is kept).`,
        head,
      );
    }

    const tree = await createTree(
      token,
      owner,
      repo,
      Object.entries(files).map(([path, content]) => ({
        path,
        mode: "100644" as const,
        type: "blob" as const,
        content,
      })),
    );
    const parentTree = await getCommitTreeSha(token, owner, repo, head);
    const repoUrl = `https://github.com/${owner}/${repo}`;

    if (parentTree === tree) {
      const integration: GitHubIntegration = {
        ...linked,
        branch,
        lastPushedSha: head,
        lastPushedContentHash: contentHash,
      };
      await setGitHubIntegrationForOwner(project.id, args.ownerId, integration);
      return {
        status: "noop",
        branch,
        commitSha: head,
        commitUrl: `${repoUrl}/commit/${head}`,
        integration,
      };
    }

    const commit = await createCommit(token, owner, repo, {
      message: args.message?.trim() || "Update from Blind Code",
      tree,
      parents: [head],
    });
    // The new commit's parent is the current remote head, so even a "force"
    // push is a fast-forward: remote-only commits stay in history, only the
    // file contents get replaced. A non-fast-forward here means someone
    // pushed in the last few seconds, and GitHub rejecting it is correct.
    await updateBranchRef(token, owner, repo, branch, commit.sha);

    const integration: GitHubIntegration = {
      ...linked,
      branch,
      lastPushedSha: commit.sha,
      lastPushedAt: new Date().toISOString(),
      lastPushedContentHash: contentHash,
    };
    await setGitHubIntegrationForOwner(project.id, args.ownerId, integration);
    return {
      status: "pushed",
      branch,
      commitSha: commit.sha,
      commitUrl: commit.html_url || `${repoUrl}/commit/${commit.sha}`,
      integration,
    };
  } catch (err) {
    return wrapGitHubError(err);
  } finally {
    inFlight.delete(project.id);
  }
};

export type GitHubProjectStatus = {
  accountConnected: boolean;
  integration: GitHubIntegration | null;
  hasLocalChanges: boolean;
  remote: { headSha: string | null; diverged: boolean } | null;
  remoteError?: string;
};

export const getGitHubProjectStatus = async (args: {
  ownerId: string;
  projectId: string;
}): Promise<GitHubProjectStatus> => {
  const project = await loadOwnedProject(args.projectId, args.ownerId);
  const token = await resolveGitHubToken(args.ownerId);
  const integration = project.integrations?.github ?? null;
  if (!integration) {
    return { accountConnected: Boolean(token), integration, hasLocalChanges: false, remote: null };
  }
  const files = await buildGitHubExport(project, args.ownerId);
  const hasLocalChanges = integration.lastPushedContentHash !== contentHashOf(files);
  if (!token) {
    return { accountConnected: false, integration, hasLocalChanges, remote: null };
  }
  try {
    const headSha = await getBranchHead(token, integration.owner, integration.repo, integration.branch);
    return {
      accountConnected: true,
      integration,
      hasLocalChanges,
      remote: {
        headSha,
        diverged: Boolean(headSha) && headSha !== integration.lastPushedSha,
      },
    };
  } catch (err) {
    return {
      accountConnected: true,
      integration,
      hasLocalChanges,
      remote: null,
      remoteError: err instanceof Error ? err.message : String(err),
    };
  }
};
