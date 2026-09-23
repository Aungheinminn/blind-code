import { tool } from "ai";
import { z } from "zod";
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
  listSupabaseOrganizations,
  runSupabaseManagementQuery,
  SupabaseManagementError,
  waitForSupabaseProjectReady,
} from "./supabaseManagement";

const SANDBOX_ROOT = "/tmp/vibe-sandbox";

const sandboxDir = (projectId: string) => join(SANDBOX_ROOT, projectId);

const safeJoin = (projectId: string, rel: string): string => {
  const root = sandboxDir(projectId);
  const abs = resolve(root, rel);
  const relFromRoot = relative(root, abs);
  if (relFromRoot.startsWith("..") || resolve(root, relFromRoot) !== abs) {
    throw new Error(`Path escapes project root: ${rel}`);
  }
  return abs;
};

export type ToolContext = {
  sandboxProjectId: string;
  dbProjectId: string | null;
  ownerId?: string | null;
  sessionId?: string | null;
  databaseUrl?: string | null;
  supabasePat?: string | null;
  supabaseProjectRef?: string | null;
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
        path: z.string().describe("Path relative to the project root, e.g. 'src/App.tsx'"),
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
        const entries: Array<{ path: string; type: "file" | "dir"; size?: number }> = [];

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
            const rel = relative(rootAbs, abs);
            if (s.isDirectory()) {
              entries.push({ path: rel, type: "dir" });
              await walk(abs);
            } else {
              entries.push({ path: rel, type: "file", size: s.size });
            }
          }
        };

        await walk(startAbs);
        return { entries };
      }),
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
        path: z.string().describe("Path relative to the project root, e.g. 'src/App.tsx'"),
        content: z.string().describe("Full file content to write (UTF-8)"),
      }),
      execute: idem(
        "write_file",
        async ({ path, content }: { path: string; content: string }) => {
          const abs = safeJoin(sandboxProjectId, path);
          await mkdir(dirname(abs), { recursive: true });
          await writeFile(abs, content, "utf-8");
          if (dbProjectId) await upsertProjectFile(dbProjectId, path, content);
          return { path, bytes: Buffer.byteLength(content, "utf-8") };
        },
      ),
    }),

    delete_file: tool({
      description: "Delete a file or directory (recursively) inside the current project.",
      inputSchema: z.object({
        path: z.string().describe("Path relative to the project root"),
      }),
      execute: idem("delete_file", async ({ path }: { path: string }) => {
        const abs = safeJoin(sandboxProjectId, path);
        await rm(abs, { recursive: true, force: true });
        if (dbProjectId) await deleteProjectFile(dbProjectId, path);
        return { path, deleted: true };
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

          return {
            ok: true as const,
            projectRef,
            url,
            attached: true,
          };
        },
      ),
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

export const buildCoderTools = (ctx: ToolContext) => ({
  ...buildReadOnlyTools(ctx),
  ...buildWriteTools(ctx),
});

export type ReadOnlyTools = ReturnType<typeof buildReadOnlyTools>;
export type WriteTools = ReturnType<typeof buildWriteTools>;
export type CoderTools = ReturnType<typeof buildCoderTools>;
