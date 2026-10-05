import { getUserById } from "../db/repo";

export type SupabasePATSource = "user" | "env";

export type ResolvedSupabasePAT = {
  pat: string;
  source: SupabasePATSource;
};

const envPat = (): string | null => {
  const raw = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  return raw ? raw : null;
};

export const resolveSupabasePAT = async (
  userId: string | null | undefined,
): Promise<ResolvedSupabasePAT | null> => {
  if (userId) {
    const user = await getUserById(userId);
    const userPat = user?.integrations?.supabase?.accessToken?.trim();
    if (userPat) return { pat: userPat, source: "user" };
  }
  const fallback = envPat();
  if (fallback) return { pat: fallback, source: "env" };
  return null;
};

export const platformSupabasePatAvailable = (): boolean => envPat() !== null;
