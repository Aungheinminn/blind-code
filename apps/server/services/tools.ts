import { tool } from "ai";
import { z } from "zod";
import { createHash } from "crypto";
import { join, resolve, relative, dirname } from "path";
import { mkdir, readFile, writeFile, readdir, stat, rm } from "fs/promises";
import postgres from "postgres";
import {
  upsertProjectFile,
  deleteProjectFile,
  getCachedToolResult,
  putCachedToolResult,
} from "../db/repo";

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
  sessionId?: string | null;
  databaseUrl?: string | null;
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
  const { sandboxProjectId, dbProjectId, sessionId, databaseUrl } = ctx;
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
        const url = databaseUrl?.trim();
        if (!url) {
          return {
            ok: false,
            error:
              "No database URL configured for this project. Ask the user to open the Supabase modal (database icon in the preview header) and add their Postgres connection string.",
          };
        }
        if (query.length > 20000) {
          return {
            ok: false,
            error: "SQL is too large (>20KB). Split it into smaller statements.",
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
            rowCount: rows.length,
            truncated: rows.length > 50,
            rows: preview,
          };
        } catch (err) {
          return {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          };
        } finally {
          try {
            await client.end({ timeout: 5 });
          } catch {}
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

export const buildCoderTools = (ctx: ToolContext) => ({
  ...buildReadOnlyTools(ctx),
  ...buildWriteTools(ctx),
});

export type ReadOnlyTools = ReturnType<typeof buildReadOnlyTools>;
export type WriteTools = ReturnType<typeof buildWriteTools>;
export type CoderTools = ReturnType<typeof buildCoderTools>;
