import { spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { existsSync } from "node:fs";

const SERVER_PORT = Number(process.env.SERVER_PORT ?? 3001);
const SERVER_HOST = "127.0.0.1";
const HEALTH_URL = `http://${SERVER_HOST}:${SERVER_PORT}/health`;

let child: ChildProcess | null = null;

function resolveServerBinary(): string {
  const binName = process.platform === "win32" ? "server.exe" : "server";
  return join(process.resourcesPath, "bin", binName);
}

async function waitForHealth(timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown = null;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(HEALTH_URL);
      if (res.ok) return;
    } catch (err) {
      lastError = err;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(
    `bundled server did not become healthy within ${timeoutMs}ms: ${String(lastError)}`,
  );
}

export async function startBundledServer(): Promise<void> {
  const binary = resolveServerBinary();
  if (!existsSync(binary)) {
    throw new Error(`bundled server binary not found at ${binary}`);
  }

  child = spawn(binary, [], {
    env: {
      ...process.env,
      PORT: String(SERVER_PORT),
      HOST: SERVER_HOST,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout?.on("data", (buf: Buffer) => {
    process.stdout.write(`[server] ${buf.toString()}`);
  });
  child.stderr?.on("data", (buf: Buffer) => {
    process.stderr.write(`[server:err] ${buf.toString()}`);
  });
  child.on("exit", (code, signal) => {
    console.log(`[server] exited code=${code} signal=${signal}`);
    child = null;
  });

  await waitForHealth();
}

export function stopBundledServer(): void {
  if (!child) return;
  try {
    child.kill("SIGTERM");
  } catch (err) {
    console.warn("[server] failed to send SIGTERM:", err);
  }
  child = null;
}

export function getServerUrl(): string {
  return `http://${SERVER_HOST}:${SERVER_PORT}`;
}
