import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { arch, platform } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const desktopDir = resolve(scriptDir, "..");
const serverEntry = resolve(desktopDir, "..", "server", "index.ts");

const BUN_TARGETS = {
  "darwin-arm64": "bun-darwin-arm64",
  "darwin-x64": "bun-darwin-x64",
  "win32-x64": "bun-windows-x64",
} as const;

type TargetKey = keyof typeof BUN_TARGETS;

const target = (process.argv[2] ?? `${platform()}-${arch()}`) as TargetKey;
const bunTarget = BUN_TARGETS[target];

if (!bunTarget) {
  console.error(
    `[build-server] unknown target "${target}". Supported: ${Object.keys(BUN_TARGETS).join(", ")}`,
  );
  process.exit(1);
}

const isWin = target.startsWith("win32");
const outName = isWin ? "server.exe" : "server";
const outDir = join(desktopDir, "resources", "bin");
const outPath = join(outDir, outName);

mkdirSync(outDir, { recursive: true });

console.log(`[build-server] compiling ${serverEntry}`);
console.log(`[build-server] target=${bunTarget} → ${outPath}`);

const result = spawnSync(
  "bun",
  [
    "build",
    "--compile",
    `--target=${bunTarget}`,
    serverEntry,
    "--outfile",
    outPath,
  ],
  { stdio: "inherit" },
);

process.exit(result.status ?? 1);
