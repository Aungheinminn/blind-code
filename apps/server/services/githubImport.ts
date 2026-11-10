import type { GitHubIntegration } from "@vibe/shared";
import { createProject, getProjectForOwner, insertProjectFiles, setGitHubIntegrationForOwner } from "../db/repo";
import { resolveGitHubToken } from "./githubToken";
import {
  getBlobBase64,
  getBranchHead,
  getRepo,
  getTreeRecursive,
  GitHubManagementError,
  type GitTreeItem,
} from "./githubManagement";
import { buildGitHubExport, contentHashOf, GitHubPushError, isValidBranchName } from "./githubPush";
import { TAILWIND_PRELUDE } from "./vercelAssembler";
import { SCAFFOLD_FILES } from "@vibe/shared/preview/scaffold";

export const IMPORT_LIMITS = {
  maxFiles: 300,
  maxFileBytes: 200_000,
  maxTotalBytes: 3_000_000,
};

const TEXT_EXT = /\.(tsx?|jsx?|mjs|cjs|css|json|svg|md|txt)$/i;
const SKIP_DIR = /(^|\/)(node_modules|dist|build|out|coverage)\//;
// The preview and the export both generate these, so importing them would
// only be overwritten (or, for main.tsx, fight the preview's own entry).
const SKIP_IN_SRC = new Set(["main.tsx", "main.jsx", "main.ts", "main.js", "index.tsx", "index.jsx", "vite-env.d.ts"]);
const SKIP_AT_ROOT = /^(package(-lock)?\.json|tsconfig(\.[\w-]+)?\.json|vite\.config\.\w+|index\.html|README\.md|bun\.lockb?|yarn\.lock|pnpm-lock\.yaml|eslint\.config\.\w+|postcss\.config\.\w+|tailwind\.config\.\w+)$/i;
const APP_ENTRY = /^App\.(tsx|jsx|ts|js)$/;

export type ImportPlan = {
  files: { repoPath: string; projectPath: string; sha: string; size: number }[];
  skipped: number;
};

// Picks which repo files become project files and where they go. Repos with a
// src/ folder (what the GitHub export writes, and what Vite/CRA use) import
// only src/, flattened to the project root; others import from the root.
export const planImport = (tree: GitTreeItem[]): ImportPlan => {
  const blobs = tree.filter((t) => t.type === "blob");
  const prefix = blobs.some((b) => b.path.startsWith("src/")) ? "src/" : "";
  const files: ImportPlan["files"] = [];
  let skipped = 0;
  let total = 0;
  for (const b of blobs) {
    if (!b.path.startsWith(prefix)) continue;
    const projectPath = b.path.slice(prefix.length);
    const name = projectPath.split("/").pop() ?? projectPath;
    const generated = prefix ? SKIP_IN_SRC.has(projectPath) : SKIP_AT_ROOT.test(projectPath);
    const hidden = projectPath.split("/").some((seg) => seg.startsWith("."));
    if (generated || hidden || SKIP_DIR.test(projectPath)) continue;
    const size = b.size ?? 0;
    if (
      !TEXT_EXT.test(name) ||
      size > IMPORT_LIMITS.maxFileBytes ||
      files.length >= IMPORT_LIMITS.maxFiles ||
      total + size > IMPORT_LIMITS.maxTotalBytes
    ) {
      skipped += 1;
      continue;
    }
    total += size;
    files.push({ repoPath: b.path, projectPath, sha: b.sha, size });
  }
  return { files, skipped };
};

export const stripExportPrelude = (css: string): string =>
  css.startsWith(TAILWIND_PRELUDE) ? css.slice(TAILWIND_PRELUDE.length) : css;

// Returns the content to store for an imported file, or null to leave it out.
// The export writes the preview's scaffold files out; an unchanged copy adds
// nothing, since the preview supplies them anyway.
export const toProjectFile = (projectPath: string, text: string): string | null => {
  const content = projectPath === "styles.css" ? stripExportPrelude(text) : text;
  return SCAFFOLD_FILES[`/${projectPath}`] === content ? null : content;
};

const decodeText = (base64: string): string | null => {
  const bytes = Buffer.from(base64, "base64");
  if (bytes.includes(0)) return null;
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
};

const mapLimit = async <T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> => {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
};

export type GitHubImportResult = {
  projectId: string;
  imported: number;
  skipped: number;
  linked: boolean;
};

export const importGitHubRepo = async (args: {
  ownerId: string;
  fullName: string;
  branch?: string;
}): Promise<GitHubImportResult> => {
  const [owner, repoName, ...extra] = args.fullName.split("/");
  if (!owner || !repoName || extra.length) {
    throw new GitHubPushError("invalid", "Repo must be in 'owner/name' form.");
  }
  if (args.branch && !isValidBranchName(args.branch)) {
    throw new GitHubPushError("invalid", "Invalid branch name.");
  }
  const token = await resolveGitHubToken(args.ownerId);
  if (!token) {
    throw new GitHubPushError("not_connected", "GitHub account not connected. Connect it at /settings/github.");
  }

  try {
    const repo = await getRepo(token, owner, repoName);
    const branch = args.branch || repo.default_branch;
    const head = await getBranchHead(token, repo.owner.login, repo.name, branch);
    if (!head) {
      throw new GitHubPushError("invalid", `${repo.full_name} has no branch '${branch}', or it's empty.`);
    }
    const { tree } = await getTreeRecursive(token, repo.owner.login, repo.name, head);
    const plan = planImport(tree);
    if (!plan.files.some((f) => APP_ENTRY.test(f.projectPath))) {
      throw new GitHubPushError(
        "invalid",
        `${repo.full_name} has no src/App.tsx (or App.jsx). Only React apps laid out like a Vite project can be imported.`,
      );
    }

    const files: Record<string, string> = {};
    let skipped = plan.skipped;
    await mapLimit(plan.files, 8, async (f) => {
      const text = decodeText(await getBlobBase64(token, repo.owner.login, repo.name, f.sha));
      if (text === null) {
        skipped += 1;
        return;
      }
      const content = toProjectFile(f.projectPath, text);
      if (content !== null) files[f.projectPath] = content;
    });

    const { id: projectId } = await createProject(repo.name, args.ownerId, {
      description: `Imported from ${repo.full_name}`,
    });
    await insertProjectFiles(projectId, files);

    // Linking with the imported head as the sync point lets the first push
    // go through without the "changed outside Blind Code" prompt.
    const canPush = repo.permissions?.push !== false;
    if (canPush) {
      const integration: GitHubIntegration = {
        owner: repo.owner.login,
        repo: repo.name,
        repoId: repo.id,
        branch,
        htmlUrl: repo.html_url,
        private: repo.private,
        linkedAt: new Date().toISOString(),
        lastPushedSha: head,
      };
      await setGitHubIntegrationForOwner(projectId, args.ownerId, integration);
      const project = await getProjectForOwner(projectId, args.ownerId);
      if (project) {
        const exported = await buildGitHubExport(project, args.ownerId);
        await setGitHubIntegrationForOwner(projectId, args.ownerId, {
          ...integration,
          lastPushedContentHash: contentHashOf(exported),
        });
      }
    }

    return { projectId, imported: Object.keys(files).length, skipped, linked: canPush };
  } catch (err) {
    if (err instanceof GitHubPushError) throw err;
    if (err instanceof GitHubManagementError) {
      throw new GitHubPushError("repo_unavailable", `GitHub: ${err.message}`);
    }
    throw err;
  }
};
