import { tool } from "ai";
import { z } from "zod";
import type { AgentToolPermissions } from "@vibe/shared";
import { createHash } from "crypto";
import { join, resolve, relative, dirname } from "path";
import { mkdir, readFile, writeFile, readdir, stat, rm } from "fs/promises";
import { randomBytes } from "crypto";
import postgres from "postgres";
import {
  upsertProjectFile,
  deleteProjectFile,
  getCachedToolResult,
  putCachedToolResult,
  setSupabaseIntegrationForOwner,
  findProjectByOwnerAndSupabaseRef,
} from "../db/repo";
import {
  createSupabaseProject,
  getSupabaseApiKeys,
  getSupabaseProject,
  listSupabaseOrganizations,
  runSupabaseManagementQuery,
  SupabaseManagementError,
  waitForSupabaseProjectReady,
} from "./supabaseManagement";
import {
  createRepoForProject,
  GitHubPushError,
  pushProjectToGitHub,
} from "./githubPush";

const SANDBOX_ROOT = "/tmp/vibe-sandbox";

const sandboxDir = (projectId: string) => join(SANDBOX_ROOT, projectId);

const normalizeProjectPath = (rel: string): string => rel.replace(/^\/+/, "");

const safeJoin = (projectId: string, rel: string): string => {
  const root = sandboxDir(projectId);
  // Treat leading slashes as "from the project root", not as filesystem-absolute.
  // Both '/App.tsx' and 'App.tsx' should resolve to <sandbox>/<project>/App.tsx.
  const relFromProject = normalizeProjectPath(rel);
  const abs = resolve(root, relFromProject);
  const relFromRoot = relative(root, abs);
  if (relFromRoot.startsWith("..") || resolve(root, relFromRoot) !== abs) {
    throw new Error(`Path escapes project root: ${rel}`);
  }
  return abs;
};

type WalkEntry = { abs: string; path: string; type: "file" | "dir"; size?: number };

const walkProject = async (rootAbs: string, startAbs: string): Promise<WalkEntry[]> => {
  const entries: WalkEntry[] = [];
  const walk = async (dir: string) => {
    let items: string[];
    try {
      items = await readdir(dir);
    } catch {
      return;
    }
    for (const name of items) {
      if (name === "node_modules" || name === ".git") continue;
      const abs = join(dir, name);
      const s = await stat(abs);
      const path = relative(rootAbs, abs);
      if (s.isDirectory()) {
        entries.push({ abs, path, type: "dir" });
        await walk(abs);
      } else {
        entries.push({ abs, path, type: "file", size: s.size });
      }
    }
  };
  await walk(startAbs);
  return entries;
};

export type SearchMatch = { path: string; line: number; text: string };

const MAX_SEARCH_MATCHES = 100;
const MAX_SEARCH_FILE_BYTES = 512 * 1024;
const MAX_MATCH_LINE_CHARS = 200;

export const searchLines = (
  path: string,
  content: string,
  pattern: RegExp,
  limit: number,
): SearchMatch[] => {
  const matches: SearchMatch[] = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length && matches.length < limit; i++) {
    pattern.lastIndex = 0;
    if (!pattern.test(lines[i])) continue;
    const text = lines[i].trim();
    matches.push({
      path,
      line: i + 1,
      text: text.length > MAX_MATCH_LINE_CHARS ? `${text.slice(0, MAX_MATCH_LINE_CHARS)}…` : text,
    });
  }
  return matches;
};

export const buildSearchPattern = (
  query: string,
  opts: { regex?: boolean; caseSensitive?: boolean },
): RegExp | { error: string } => {
  const source = opts.regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  try {
    return new RegExp(source, opts.caseSensitive ? "" : "i");
  } catch (e) {
    return { error: `Invalid regex: ${e instanceof Error ? e.message : String(e)}` };
  }
};

export const readProjectFile = (sandboxProjectId: string, path: string): Promise<string> =>
  readFile(safeJoin(sandboxProjectId, path), "utf-8");

export type EditResult =
  | { ok: true; content: string; replacements: number }
  | { ok: false; error: string };

export const applyEdit = (
  content: string,
  oldString: string,
  newString: string,
  replaceAll = false,
): EditResult => {
  if (oldString === "") {
    return { ok: false, error: "old_string is empty. Use write_file to create a file." };
  }
  if (oldString === newString) {
    return { ok: false, error: "old_string and new_string are identical; nothing to change." };
  }
  const count = content.split(oldString).length - 1;
  if (count === 0) {
    return {
      ok: false,
      error: "old_string was not found. read_file again and copy the text exactly, including whitespace.",
    };
  }
  if (count > 1 && !replaceAll) {
    return {
      ok: false,
      error: `old_string matches ${count} places. Include more surrounding lines to make it unique, or set replace_all.`,
    };
  }
  // split/join rather than String.replace so "$&"-style patterns in new_string stay literal.
  const next = replaceAll
    ? content.split(oldString).join(newString)
    : content.replace(oldString, () => newString);
  return { ok: true, content: next, replacements: replaceAll ? count : 1 };
};

export type ToolContext = {
  sandboxProjectId: string;
  dbProjectId: string | null;
  ownerId?: string | null;
  sessionId?: string | null;
  databaseUrl?: string | null;
  supabasePat?: string | null;
  supabaseProjectRef?: string | null;
  githubConnected?: boolean;
};

const hashInput = (toolName: string, input: unknown): string =>
  createHash("sha256").update(`${toolName}:${JSON.stringify(input ?? null)}`).digest("hex");

const withIdempotency = <I, O>(
  sessionId: string | null | undefined,
  toolName: string,
  fn: (input: I) => Promise<O>,
) => {
  return async (input: I, opts: { toolCallId?: string } = {}): Promise<O> => {
    const toolCallId = opts.toolCallId;
    if (!sessionId || !toolCallId) return fn(input);

    const inputHash = hashInput(toolName, input);
    const cached = await getCachedToolResult(sessionId, toolCallId);
    if (cached && cached.inputHash === inputHash) {
      return cached.result as O;
    }

    const result = await fn(input);
    await putCachedToolResult(sessionId, toolCallId, toolName, inputHash, result);
    return result;
  };
};

export const buildReadOnlyTools = (ctx: ToolContext) => {
  const { sandboxProjectId, sessionId } = ctx;
  const idem = <I, O>(name: string, fn: (input: I) => Promise<O>) =>
    withIdempotency(sessionId, name, fn);

  return {
    read_file: tool({
      description:
        "Read the contents of a text file inside the current project. Returns the file contents as a UTF-8 string.",
      inputSchema: z.object({
        path: z.string().describe("Path from the project root, e.g. '/App.tsx' or '/components/Header.tsx'."),
      }),
      execute: idem("read_file", async ({ path }: { path: string }) => {
        const abs = safeJoin(sandboxProjectId, path);
        const content = await readFile(abs, "utf-8");
        return { path, content };
      }),
    }),

    list_files: tool({
      description:
        "Recursively list files and directories inside the current project. Returns paths relative to the project root.",
      inputSchema: z.object({
        path: z
          .string()
          .optional()
          .describe("Directory relative to project root. Defaults to the root."),
      }),
      execute: idem("list_files", async ({ path }: { path?: string }) => {
        const rootAbs = sandboxDir(sandboxProjectId);
        await mkdir(rootAbs, { recursive: true });
        const startAbs = safeJoin(sandboxProjectId, path ?? ".");
        const entries = (await walkProject(rootAbs, startAbs)).map(({ path, type, size }) =>
          type === "dir" ? { path, type } : { path, type, size },
        );
        return { entries };
      }),
    }),

    search_files: tool({
      description:
        "Search file contents across the project, like grep. Returns matching lines as { path, line, text }, capped at 100 matches. Use it to find where something is defined or used instead of reading files one by one.",
      inputSchema: z.object({
        query: z.string().min(1).describe("Text to search for. Treated literally unless regex is true."),
        regex: z.boolean().optional().describe("Interpret query as a JavaScript regular expression."),
        case_sensitive: z.boolean().optional().describe("Match case exactly. Defaults to false."),
        path: z.string().optional().describe("Directory to search under, relative to the project root. Defaults to the root."),
      }),
      execute: idem(
        "search_files",
        async ({
          query,
          regex,
          case_sensitive,
          path,
        }: {
          query: string;
          regex?: boolean;
          case_sensitive?: boolean;
          path?: string;
        }) => {
          const pattern = buildSearchPattern(query, { regex, caseSensitive: case_sensitive });
          if (!(pattern instanceof RegExp)) return { ok: false as const, error: pattern.error };
          const rootAbs = sandboxDir(sandboxProjectId);
          await mkdir(rootAbs, { recursive: true });
          const files = (await walkProject(rootAbs, safeJoin(sandboxProjectId, path ?? "."))).filter(
            (e) => e.type === "file" && (e.size ?? 0) <= MAX_SEARCH_FILE_BYTES,
          );
          const matches: SearchMatch[] = [];
          for (const f of files) {
            if (matches.length >= MAX_SEARCH_MATCHES) break;
            const content = await readFile(f.abs, "utf-8").catch(() => null);
            if (content === null) continue;
            matches.push(...searchLines(f.path, content, pattern, MAX_SEARCH_MATCHES - matches.length));
          }
          return { ok: true as const, matches, truncated: matches.length >= MAX_SEARCH_MATCHES };
        },
      ),
    }),
  };
};

export const buildWriteTools = (ctx: ToolContext) => {
  const { sandboxProjectId, dbProjectId, sessionId } = ctx;
  const idem = <I, O>(name: string, fn: (input: I) => Promise<O>) =>
    withIdempotency(sessionId, name, fn);

  return {
    write_file: tool({
      description:
        "Create or overwrite a text file inside the current project. Parent directories are created automatically.",
      inputSchema: z.object({
        path: z.string().describe("Path from the project root, e.g. '/App.tsx' or '/components/Header.tsx'. Do NOT prefix with 'src/'."),
        content: z.string().describe("Full file content to write (UTF-8)"),
      }),
      execute: idem(
        "write_file",
        async ({ path, content }: { path: string; content: string }) => {
          const abs = safeJoin(sandboxProjectId, path);
          const stored = normalizeProjectPath(path);
          await mkdir(dirname(abs), { recursive: true });
          await writeFile(abs, content, "utf-8");
          if (dbProjectId) await upsertProjectFile(dbProjectId, stored, content);
          return { path: stored, bytes: Buffer.byteLength(content, "utf-8") };
        },
      ),
    }),

    edit_file: tool({
      description:
        "Replace an exact snippet of text in an existing file. Prefer this over write_file for changes to part of a file. old_string must match the file exactly (including indentation) and must be unique unless replace_all is set. read_file first so you copy the current text.",
      inputSchema: z.object({
        path: z.string().describe("Path from the project root, e.g. '/App.tsx'."),
        old_string: z.string().describe("Exact text to find. Include enough surrounding lines to be unique."),
        new_string: z.string().describe("Text to put in its place."),
        replace_all: z.boolean().optional().describe("Replace every occurrence instead of requiring a unique match."),
      }),
      execute: idem(
        "edit_file",
        async ({
          path,
          old_string,
          new_string,
          replace_all,
        }: {
          path: string;
          old_string: string;
          new_string: string;
          replace_all?: boolean;
        }) => {
          const abs = safeJoin(sandboxProjectId, path);
          const stored = normalizeProjectPath(path);
          let current: string;
          try {
            current = await readFile(abs, "utf-8");
          } catch {
            return { ok: false as const, error: `File not found: ${stored}. Use write_file to create it.` };
          }
          const edit = applyEdit(current, old_string, new_string, replace_all);
          if (!edit.ok) return edit;
          await writeFile(abs, edit.content, "utf-8");
          if (dbProjectId) await upsertProjectFile(dbProjectId, stored, edit.content);
          return { ok: true as const, path: stored, replacements: edit.replacements };
        },
      ),
    }),

    delete_file: tool({
      description: "Delete a file or directory (recursively) inside the current project.",
      inputSchema: z.object({
        path: z.string().describe("Path from the project root"),
      }),
      execute: idem("delete_file", async ({ path }: { path: string }) => {
        const abs = safeJoin(sandboxProjectId, path);
        const stored = normalizeProjectPath(path);
        await rm(abs, { recursive: true, force: true });
        if (dbProjectId) await deleteProjectFile(dbProjectId, stored);
        return { path: stored, deleted: true };
      }),
    }),

    run_sql: tool({
      description:
        "Execute SQL against the project's connected Postgres database (Supabase). Use for CREATE TABLE, ALTER TABLE, CREATE POLICY, and other DDL, or one-off data setup. Multiple statements separated by semicolons are allowed. The user must have provided a database URL in the Supabase connection modal — if they haven't, this tool returns an error asking them to add one. Never call this to run destructive DROP DATABASE, TRUNCATE without user consent, or arbitrary data-mutating queries the user didn't ask for.",
      inputSchema: z.object({
        sql: z
          .string()
          .describe(
            "The SQL to execute. Prefer idempotent DDL like CREATE TABLE IF NOT EXISTS, CREATE POLICY IF NOT EXISTS.",
          ),
      }),
      execute: idem("run_sql", async ({ sql: query }: { sql: string }) => {
        if (query.length > 20000) {
          return {
            ok: false,
            error: "SQL is too large (>20KB). Split it into smaller statements.",
          };
        }

        const pat = ctx.supabasePat;
        const ref = ctx.supabaseProjectRef;
        if (pat && ref) {
          try {
            const result = await runSupabaseManagementQuery(pat, ref, query);
            const rows = Array.isArray(result) ? result : [];
            const preview = rows.slice(0, 50);
            return {
              ok: true,
              via: "management-api" as const,
              rowCount: rows.length,
              truncated: rows.length > 50,
              rows: preview,
            };
          } catch (err) {
            const message =
              err instanceof SupabaseManagementError
                ? err.message
                : err instanceof Error
                  ? err.message
                  : String(err);
            return { ok: false, via: "management-api" as const, error: message };
          }
        }

        const url = ctx.databaseUrl?.trim();
        if (!url) {
          return {
            ok: false,
            error:
              "No SQL path available for this project. Either attach a Supabase project on the /supabase page (recommended) or add a Postgres connection URL in the workspace's Supabase modal.",
          };
        }
        const client = postgres(url, {
          max: 1,
          prepare: false,
          connect_timeout: 10,
          ssl: "require",
        });
        try {
          const result = await client.unsafe(query).simple();
          const rows = Array.isArray(result) ? result : [];
          const preview = rows.slice(0, 50);
          return {
            ok: true,
            via: "direct-postgres" as const,
            rowCount: rows.length,
            truncated: rows.length > 50,
            rows: preview,
          };
        } catch (err) {
          return {
            ok: false,
            via: "direct-postgres" as const,
            error: err instanceof Error ? err.message : String(err),
          };
        } finally {
          try {
            await client.end({ timeout: 5 });
          } catch {}
        }
      }),
    }),

    create_supabase_project: tool({
      description:
        "Provision a new Supabase project for this workspace. Only call when the app the user is building genuinely needs persistent data, auth, or realtime (e.g. todo lists, chat, dashboards) — not for stateless UIs (calculators, static pages, single-render tools). Requires the user to have connected their Supabase account at /settings/supabase. If they haven't, returns an error asking them to. Provisioning takes ~60–120s (the tool polls until ready). After this succeeds, follow up with attach_supabase_project to link the new project to this workspace.",
      inputSchema: z.object({
        name: z
          .string()
          .min(1)
          .max(80)
          .describe(
            "Human-readable project name shown in the Supabase dashboard, e.g. 'todo-app-prod'.",
          ),
        organizationSlug: z
          .string()
          .optional()
          .describe(
            "Supabase organization slug. Omit if the user has exactly one org (auto-selected).",
          ),
        regionCode: z
          .string()
          .optional()
          .describe(
            "Supabase region code, e.g. 'us-east-1', 'eu-west-1', 'ap-southeast-1'. Defaults to 'us-east-1'.",
          ),
      }),
      execute: idem(
        "create_supabase_project",
        async ({
          name,
          organizationSlug,
          regionCode,
        }: {
          name: string;
          organizationSlug?: string;
          regionCode?: string;
        }) => {
          const pat = ctx.supabasePat;
          if (!pat) {
            return {
              ok: false as const,
              error:
                "Supabase account not connected. Ask the user to connect their Supabase PAT at /settings/supabase, then retry.",
            };
          }

          let slug = organizationSlug?.trim() || "";
          if (!slug) {
            try {
              const orgs = await listSupabaseOrganizations(pat);
              if (orgs.length === 0) {
                return {
                  ok: false as const,
                  error:
                    "Your Supabase account has no organizations. Create one at https://supabase.com/dashboard first.",
                };
              }
              if (orgs.length > 1) {
                return {
                  ok: false as const,
                  error: `Multiple Supabase organizations found — specify organizationSlug. Options: ${orgs
                    .map((o) => o.slug ?? o.id)
                    .join(", ")}`,
                };
              }
              slug = orgs[0].slug ?? orgs[0].id;
            } catch (err) {
              return {
                ok: false as const,
                error: `Failed to list Supabase organizations: ${err instanceof Error ? err.message : String(err)}`,
              };
            }
          }

          const region = regionCode?.trim() || "us-east-1";
          const dbPass = randomBytes(24).toString("base64url");

          try {
            const created = await createSupabaseProject(pat, {
              name,
              organizationSlug: slug,
              dbPass,
              regionCode: region,
            });
            const ready = await waitForSupabaseProjectReady(pat, created.id, {
              timeoutMs: 180_000,
              pollMs: 3_000,
            });
            return {
              ok: true as const,
              projectRef: created.id,
              name: created.name,
              region: created.region,
              organizationId: created.organization_id,
              status: ready.status ?? "ACTIVE_HEALTHY",
              dashboardUrl: `https://supabase.com/dashboard/project/${created.id}`,
            };
          } catch (err) {
            const message =
              err instanceof SupabaseManagementError
                ? err.message
                : err instanceof Error
                  ? err.message
                  : String(err);
            return { ok: false as const, error: message };
          }
        },
      ),
    }),

    attach_supabase_project: tool({
      description:
        "Link an existing Supabase project (identified by its projectRef) to this workspace. Fetches the API keys via the user's PAT and stores them encrypted. Call this immediately after create_supabase_project, or when the user wants to connect an existing Supabase project to this workspace. After this succeeds, run_sql works in the same turn.",
      inputSchema: z.object({
        projectRef: z
          .string()
          .min(1)
          .describe(
            "The Supabase project ref (id), e.g. 'abcdefghijklmnop'. Returned by create_supabase_project.",
          ),
      }),
      execute: idem(
        "attach_supabase_project",
        async ({ projectRef }: { projectRef: string }) => {
          const pat = ctx.supabasePat;
          if (!pat) {
            return {
              ok: false as const,
              error:
                "Supabase account not connected. Ask the user to connect at /settings/supabase, then retry.",
            };
          }
          if (!ctx.ownerId || !dbProjectId) {
            return {
              ok: false as const,
              error: "No workspace project in context — cannot attach.",
            };
          }

          const existing = await findProjectByOwnerAndSupabaseRef(
            ctx.ownerId,
            projectRef,
          );
          if (existing && existing.id !== dbProjectId) {
            return {
              ok: false as const,
              error: `Supabase project ${projectRef} is already attached to another workspace ('${existing.name}'). Detach it there first.`,
            };
          }

          let keys: Array<{ name: string; api_key: string }>;
          try {
            keys = await getSupabaseApiKeys(pat, projectRef);
          } catch (err) {
            const message =
              err instanceof SupabaseManagementError
                ? err.message
                : err instanceof Error
                  ? err.message
                  : String(err);
            return { ok: false as const, error: `Failed to fetch API keys: ${message}` };
          }

          const anonKey = keys.find((k) => k.name === "anon")?.api_key;
          const serviceRoleKey = keys.find((k) => k.name === "service_role")?.api_key;
          if (!anonKey || !serviceRoleKey) {
            return {
              ok: false as const,
              error: "Supabase did not return both anon and service_role keys.",
            };
          }
          // Sanity check: both are JWTs; swapping would be catastrophic.
          if (!anonKey.startsWith("eyJ") || !serviceRoleKey.startsWith("eyJ")) {
            return {
              ok: false as const,
              error: "Unexpected Supabase key format — refusing to store.",
            };
          }

          const url = `https://${projectRef}.supabase.co`;
          const saved = await setSupabaseIntegrationForOwner(dbProjectId, ctx.ownerId, {
            url,
            anonKey,
            serviceRoleKey,
            projectRef,
            connectedAt: new Date().toISOString(),
          });
          if (!saved) {
            return { ok: false as const, error: "Failed to persist Supabase integration." };
          }

          // Hot-swap so subsequent run_sql calls this turn go through Management API.
          ctx.supabaseProjectRef = projectRef;

          // Best-effort fetch of project metadata so the client can show a
          // human-readable name instead of just the ref. Failure here must not
          // break the attach — the keys are already saved.
          let name: string | null = null;
          try {
            const project = await getSupabaseProject(pat, projectRef);
            if (project?.name) name = project.name;
          } catch {}

          return {
            ok: true as const,
            projectRef,
            url,
            anonKey,
            attached: true,
            ...(name ? { name } : {}),
          };
        },
      ),
    }),

    github_create_repo: tool({
      description:
        "Create a new GitHub repository on the user's account and link it to this project. Only call when the user explicitly asks to put the project on GitHub and no repo is linked yet. Follow up with github_push to upload the code.",
      inputSchema: z.object({
        name: z
          .string()
          .min(1)
          .max(100)
          .regex(/^[A-Za-z0-9._-]+$/)
          .describe("Repository name, e.g. 'todo-app'. Letters, numbers, '.', '-', '_' only."),
        private: z
          .boolean()
          .optional()
          .describe("Defaults to true. Only set false if the user asked for a public repo."),
        description: z.string().max(200).optional(),
      }),
      execute: idem(
        "github_create_repo",
        async (input: { name: string; private?: boolean; description?: string }) => {
          if (!ctx.ownerId || !dbProjectId) {
            return { ok: false as const, error: "No workspace project in context." };
          }
          try {
            const integration = await createRepoForProject({
              ownerId: ctx.ownerId,
              projectId: dbProjectId,
              ...input,
            });
            return { ok: true as const, integration, url: integration.htmlUrl };
          } catch (err) {
            return {
              ok: false as const,
              error: err instanceof Error ? err.message : String(err),
            };
          }
        },
      ),
    }),

    github_push: tool({
      description:
        "Commit the current project files and push them to the GitHub repo linked to this project. Only call when the user explicitly asks to push / commit / save to GitHub, and only once, after all file changes for the turn are written.",
      inputSchema: z.object({
        message: z
          .string()
          .min(1)
          .max(200)
          .describe("Concise commit message describing what changed, e.g. 'Add dark mode toggle'."),
      }),
      execute: idem("github_push", async ({ message }: { message: string }) => {
        if (!ctx.ownerId || !dbProjectId) {
          return { ok: false as const, error: "No workspace project in context." };
        }
        try {
          const result = await pushProjectToGitHub({
            ownerId: ctx.ownerId,
            projectId: dbProjectId,
            message,
          });
          return { ok: true as const, ...result };
        } catch (err) {
          if (err instanceof GitHubPushError && err.code === "diverged") {
            return {
              ok: false as const,
              error: `${err.message} Do not retry. Tell the user to open the GitHub button in the preview header to choose.`,
            };
          }
          return {
            ok: false as const,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }),
    }),

    update_todo: tool({
      description:
        "Report progress on a todo from the plan. Call this immediately before starting a todo (status:'active'), after finishing it (status:'done'), or if it becomes unnecessary (status:'skipped'). The user's UI reflects this in real time. Only call this when a plan was provided.",
      inputSchema: z.object({
        id: z.string().describe("The todo id from the plan, e.g. 't1'."),
        status: z
          .enum(["active", "done", "skipped"])
          .describe("'active' when starting, 'done' when finished, 'skipped' if no longer needed."),
        note: z
          .string()
          .optional()
          .describe("Optional one-line note, e.g. 'skipped: tailwind already installed'."),
      }),
      execute: async ({
        id,
        status,
        note,
      }: {
        id: string;
        status: "active" | "done" | "skipped";
        note?: string;
      }) => ({ id, status, note: note ?? null }),
    }),
  };
};

export const buildCoderTools = (
  ctx: ToolContext,
  permissions: AgentToolPermissions = {},
) => {
  const write = buildWriteTools(ctx) as Record<string, unknown>;
  // Missing permission key = allowed by default (backwards-compat, permissive).
  if (permissions.create_supabase_project === false) {
    delete write.create_supabase_project;
  }
  if (permissions.attach_supabase_project === false) {
    delete write.attach_supabase_project;
  }
  // Unlike the Supabase tools these are opt-in: missing key = denied.
  if (permissions.github_create_repo !== true || !ctx.githubConnected) {
    delete write.github_create_repo;
  }
  if (permissions.github_push !== true || !ctx.githubConnected) {
    delete write.github_push;
  }
  return { ...buildReadOnlyTools(ctx), ...write };
};

export type ReadOnlyTools = ReturnType<typeof buildReadOnlyTools>;
export type WriteTools = ReturnType<typeof buildWriteTools>;
export type CoderTools = ReturnType<typeof buildCoderTools>;
