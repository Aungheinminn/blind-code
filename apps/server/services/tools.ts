import { tool } from "ai";
import { z } from "zod";
import { join, resolve, relative, dirname } from "path";
import { mkdir, readFile, writeFile, readdir, stat, rm } from "fs/promises";
import { upsertProjectFile, deleteProjectFile } from "../db/repo";

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
};

export const buildAgentTools = (ctx: ToolContext) => {
  const { sandboxProjectId, dbProjectId } = ctx;
  return {
    read_file: tool({
      description:
        "Read the contents of a text file inside the current project. Returns the file contents as a UTF-8 string.",
      inputSchema: z.object({
        path: z.string().describe("Path relative to the project root, e.g. 'src/App.tsx'"),
      }),
      execute: async ({ path }) => {
        const abs = safeJoin(sandboxProjectId, path);
        const content = await readFile(abs, "utf-8");
        return { path, content };
      },
    }),

    write_file: tool({
      description:
        "Create or overwrite a text file inside the current project. Parent directories are created automatically.",
      inputSchema: z.object({
        path: z.string().describe("Path relative to the project root, e.g. 'src/App.tsx'"),
        content: z.string().describe("Full file content to write (UTF-8)"),
      }),
      execute: async ({ path, content }) => {
        const abs = safeJoin(sandboxProjectId, path);
        await mkdir(dirname(abs), { recursive: true });
        await writeFile(abs, content, "utf-8");
        if (dbProjectId) await upsertProjectFile(dbProjectId, path, content);
        return { path, bytes: Buffer.byteLength(content, "utf-8") };
      },
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
      execute: async ({ path }) => {
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
      },
    }),

    delete_file: tool({
      description: "Delete a file or directory (recursively) inside the current project.",
      inputSchema: z.object({
        path: z.string().describe("Path relative to the project root"),
      }),
      execute: async ({ path }) => {
        const abs = safeJoin(sandboxProjectId, path);
        await rm(abs, { recursive: true, force: true });
        if (dbProjectId) await deleteProjectFile(dbProjectId, path);
        return { path, deleted: true };
      },
    }),

    run_command: tool({
      description:
        "Run a shell command inside the project sandbox. Returns stdout, stderr, and the exit code. Use for installs, builds, and quick checks. Long-running dev servers should NOT be started with this — the platform manages those separately.",
      inputSchema: z.object({
        command: z
          .array(z.string())
          .min(1)
          .describe("Argv array, e.g. ['bun', 'install'] or ['bun', 'run', 'build']"),
        timeoutMs: z
          .number()
          .int()
          .positive()
          .max(120_000)
          .optional()
          .describe("Kill the process after this many ms. Default 60000."),
      }),
      execute: async ({ command, timeoutMs }) => {
        const cwd = sandboxDir(sandboxProjectId);
        await mkdir(cwd, { recursive: true });

        const child = Bun.spawn(command, {
          cwd,
          stdout: "pipe",
          stderr: "pipe",
          env: { ...process.env, CI: "1" },
        });

        const timer = setTimeout(() => {
          try {
            child.kill("SIGKILL");
          } catch {}
        }, timeoutMs ?? 60_000);

        const [stdout, stderr, exitCode] = await Promise.all([
          new Response(child.stdout).text(),
          new Response(child.stderr).text(),
          child.exited,
        ]);
        clearTimeout(timer);

        const cap = (s: string) => (s.length > 8000 ? s.slice(0, 8000) + "\n…[truncated]" : s);
        return {
          command: command.join(" "),
          exitCode,
          stdout: cap(stdout),
          stderr: cap(stderr),
        };
      },
    }),
  };
};

export type AgentTools = ReturnType<typeof buildAgentTools>;
