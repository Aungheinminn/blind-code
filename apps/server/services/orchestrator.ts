import { join } from "path";
import { mkdir, rm, writeFile } from "fs/promises";

type SpawnResult = {
  id: string;
  pid: number;
  cwd: string;
};

type SpawnOptions = {
  projectId: string;
  command: string[];
  files: Array<{ path: string; content: string }>;
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
  onExit?: (code: number | null) => void;
};

type ProcessRecord = {
  process: ReturnType<typeof Bun.spawn>;
  cwd: string;
};

const SANDBOX_ROOT = "/tmp/vibe-sandbox";

export class Orchestrator {
  private processes = new Map<string, ProcessRecord>();

  async spawn(options: SpawnOptions): Promise<SpawnResult> {
    const sandboxDir = join(SANDBOX_ROOT, options.projectId);
    await this.prepareSandbox(sandboxDir, options.files);

    const child = Bun.spawn(options.command, {
      cwd: sandboxDir,
      stdout: "pipe",
      stderr: "pipe",
      stdin: "pipe",
      env: Bun.env,
    });

    const id = crypto.randomUUID();
    this.processes.set(id, { process: child, cwd: sandboxDir });

    const decoder = new TextDecoder();
    const pump = async (
      stream: ReadableStream<Uint8Array> | null | undefined,
      cb?: (data: string) => void,
    ) => {
      if (!stream || !cb) return;
      for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>) {
        cb(decoder.decode(chunk));
      }
    };
    pump(child.stdout, options.onStdout);
    pump(child.stderr, options.onStderr);
    child.exited.then((code) => {
      options.onExit?.(code ?? null);
      this.processes.delete(id);
    });

    return {
      id,
      pid: child.pid ?? -1,
      cwd: sandboxDir,
    };
  }

  async stop(id: string): Promise<void> {
    const record = this.processes.get(id);
    if (!record) return;
    record.process.kill("SIGTERM");
    this.processes.delete(id);
  }

  async resetSandbox(projectId: string): Promise<void> {
    const sandboxDir = join(SANDBOX_ROOT, projectId);
    await rm(sandboxDir, { recursive: true, force: true });
    await mkdir(sandboxDir, { recursive: true });
  }

  private async prepareSandbox(
    sandboxDir: string,
    files: Array<{ path: string; content: string }>
  ): Promise<void> {
    await rm(sandboxDir, { recursive: true, force: true });
    await mkdir(sandboxDir, { recursive: true });

    await Promise.all(
      files.map(async (file) => {
        const absolutePath = join(sandboxDir, file.path);
        const dir = absolutePath.split("/").slice(0, -1).join("/");
        await mkdir(dir, { recursive: true });
        await writeFile(absolutePath, file.content, "utf-8");
      })
    );
  }
}
