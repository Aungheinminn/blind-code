import { getUserById } from "../db/repo";

export type VercelTokenSource = "user" | "env";

export type ResolvedVercelToken = {
  token: string;
  source: VercelTokenSource;
};

const envToken = (): string | null => {
  const raw = process.env.VERCEL_API_TOKEN?.trim();
  return raw ? raw : null;
};

export const resolveVercelToken = async (
  userId: string | null | undefined,
): Promise<ResolvedVercelToken | null> => {
  if (userId) {
    const user = await getUserById(userId);
    const userTok = user?.integrations?.vercel?.apiToken?.trim();
    if (userTok) return { token: userTok, source: "user" };
  }
  const fallback = envToken();
  if (fallback) return { token: fallback, source: "env" };
  return null;
};

export const platformVercelTokenAvailable = (): boolean =>
  envToken() !== null;
