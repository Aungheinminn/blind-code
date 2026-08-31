import { join } from "path";
import { existsSync } from "fs";
import { mkdir } from "fs/promises";
import { createServer } from "net";

const SANDBOX_ROOT = "/tmp/vibe-sandbox";
const PORT_START = 5100;
const PORT_END = 5999;
const READY_TIMEOUT_MS = 30_000;

type Running = {
  projectId: string;
  port: number;
  url: string;
  process: ReturnType<typeof Bun.spawn>;
  installedHash?: string;
};

const findFreePort = async (): Promise<number> => {
  for (let i = 0; i < 10; i++) {
    const port = Math.floor(Math.random() * (PORT_END - PORT_START + 1)) + PORT_START;
    const free = await new Promise<boolean>((resolve) => {
      const srv = createServer();
      srv.once("error", () => resolve(false));
      srv.once("listening", () => srv.close(() => resolve(true)));
      srv.listen(port, "127.0.0.1");
    });
    if (free) return port;
  }
  throw new Error("No free port available in preview range");
};

const waitForPort = async (port: number, timeoutMs: number): Promise<boolean> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await new Promise<boolean>((resolve) => {
      const socket = new (require("net").Socket)();
      socket.setTimeout(500);
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("error", () => resolve(false));
      socket.once("timeout", () => {
        socket.destroy();
        resolve(false);
      });
      socket.connect(port, "127.0.0.1");
    });
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
};

const readPackageJson = async (dir: string): Promise<any | null> => {
  const path = join(dir, "package.json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(await Bun.file(path).text());
  } catch {
    return null;
  }
};

const pickDevCommand = (pkg: any, port: number): string[] | null => {
  if (!pkg?.scripts) return null;
  if (typeof pkg.scripts.dev === "string") {
    return ["bun", "run", "dev", "--", "--port", String(port), "--host", "0.0.0.0"];
  }
  if (typeof pkg.scripts.start === "string") {
    return ["bun", "run", "start", "--", "--port", String(port), "--host", "0.0.0.0"];
  }
  return null;
};

export type PreviewStatus =
  | { state: "none"; reason: string }
  | { state: "installing" }
  | { state: "starting"; port: number }
  | { state: "ready"; url: string }
  | { state: "error"; error: string };

export class PreviewManager {
  private running = new Map<string, Running>();

  async ensureRunning(
    projectId: string,
    onStatus?: (s: PreviewStatus) => void,
  ): Promise<PreviewStatus> {
    const existing = this.running.get(projectId);
    if (existing) {
      const status: PreviewStatus = { state: "ready", url: existing.url };
      onStatus?.(status);
      return status;
    }

    const cwd = join(SANDBOX_ROOT, projectId);
    await mkdir(cwd, { recursive: true });
    const pkg = await readPackageJson(cwd);

    if (!pkg) {
      const s: PreviewStatus = { state: "none", reason: "no package.json in project" };
      onStatus?.(s);
      return s;
    }

    const port = await findFreePort();
    const command = pickDevCommand(pkg, port);
    if (!command) {
      const s: PreviewStatus = { state: "none", reason: "no 'dev' or 'start' script" };
      onStatus?.(s);
      return s;
    }

    if (existsSync(join(cwd, "package.json")) && !existsSync(join(cwd, "node_modules"))) {
      onStatus?.({ state: "installing" });
      const install = Bun.spawn(["bun", "install"], {
        cwd,
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, CI: "1" },
      });
      const installExit = await install.exited;
      if (installExit !== 0) {
        const err = await new Response(install.stderr).text();
        const s: PreviewStatus = { state: "error", error: `bun install failed: ${err.slice(0, 500)}` };
        onStatus?.(s);
        return s;
      }
    }

    onStatus?.({ state: "starting", port });

    const child = Bun.spawn(command, {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, PORT: String(port), HOST: "0.0.0.0" },
    });

    const running: Running = {
      projectId,
      port,
      url: `http://localhost:${port}`,
      process: child,
    };
    this.running.set(projectId, running);

    child.exited.then(() => {
      if (this.running.get(projectId) === running) this.running.delete(projectId);
    });

    const ready = await waitForPort(port, READY_TIMEOUT_MS);
    if (!ready) {
      try {
        child.kill("SIGTERM");
      } catch {}
      this.running.delete(projectId);
      const s: PreviewStatus = { state: "error", error: `dev server did not open port ${port} within ${READY_TIMEOUT_MS}ms` };
      onStatus?.(s);
      return s;
    }

    const s: PreviewStatus = { state: "ready", url: running.url };
    onStatus?.(s);
    return s;
  }

  stop(projectId: string): void {
    const r = this.running.get(projectId);
    if (!r) return;
    try {
      r.process.kill("SIGTERM");
    } catch {}
    this.running.delete(projectId);
  }

  stopAll(): void {
    for (const r of this.running.values()) {
      try {
        r.process.kill("SIGTERM");
      } catch {}
    }
    this.running.clear();
  }
}

export const previewManager = new PreviewManager();

process.on("SIGINT", () => {
  previewManager.stopAll();
  process.exit(0);
});
process.on("SIGTERM", () => {
  previewManager.stopAll();
  process.exit(0);
});
