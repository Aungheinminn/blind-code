import { existsSync } from "fs";
import { chmod, mkdir, readFile, rename, stat, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { homedir } from "os";

export type ProviderCredential = {
  apiKey: string;
  updatedAt: string;
};

export type AuthFile = {
  version: 1;
  providers: Record<string, ProviderCredential>;
};

const EMPTY: AuthFile = { version: 1, providers: {} };

export const authFilePath = (): string => {
  if (process.env.BLIND_CODE_AUTH_FILE) return process.env.BLIND_CODE_AUTH_FILE;
  const configHome = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(configHome, "blind-code", "auth.json");
};

let cache: { data: AuthFile; mtimeMs: number } | null = null;

const parseFile = (raw: string): AuthFile => {
  const parsed = JSON.parse(raw);
  if (parsed?.version !== 1) return { ...EMPTY };
  return {
    version: 1,
    providers: parsed.providers && typeof parsed.providers === "object" ? parsed.providers : {},
  };
};

export const readAuth = async (): Promise<AuthFile> => {
  const path = authFilePath();
  if (!existsSync(path)) {
    cache = null;
    return { ...EMPTY };
  }
  const st = await stat(path);
  if (cache && cache.mtimeMs === st.mtimeMs) return cache.data;
  try {
    const raw = await readFile(path, "utf-8");
    const data = parseFile(raw);
    cache = { data, mtimeMs: st.mtimeMs };
    return data;
  } catch {
    return { ...EMPTY };
  }
};

const writeAuth = async (next: AuthFile): Promise<void> => {
  const path = authFilePath();
  const dir = dirname(path);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await chmod(dir, 0o700).catch(() => {});
  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify(next, null, 2), { mode: 0o600 });
  await rename(tmp, path);
  await chmod(path, 0o600).catch(() => {});
  const st = await stat(path);
  cache = { data: next, mtimeMs: st.mtimeMs };
};

export const getStoredKey = async (provider: string): Promise<string | null> => {
  const auth = await readAuth();
  return auth.providers[provider]?.apiKey ?? null;
};

export const setStoredKey = async (provider: string, apiKey: string): Promise<void> => {
  const trimmed = apiKey.trim();
  if (!trimmed) throw new Error("apiKey must be non-empty");
  const auth = await readAuth();
  await writeAuth({
    ...auth,
    providers: {
      ...auth.providers,
      [provider]: { apiKey: trimmed, updatedAt: new Date().toISOString() },
    },
  });
};

export const removeStoredKey = async (provider: string): Promise<boolean> => {
  const auth = await readAuth();
  if (!(provider in auth.providers)) return false;
  const { [provider]: _removed, ...rest } = auth.providers;
  await writeAuth({ ...auth, providers: rest });
  return true;
};

export const last4 = (s: string): string => (s.length <= 4 ? s : s.slice(-4));
