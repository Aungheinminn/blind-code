import { eq, inArray } from "drizzle-orm";
import { db, schema } from "../client";
import type {
  GitHubAccountIntegration,
  ProviderKey,
  SupabaseAccountIntegration,
  UserIntegrations,
  UserProviderKeys,
  VercelAccountIntegration,
} from "@vibe/shared";
import { encryptUserIntegrations, decryptUserRow } from "./rows";

export const findUserByEmail = async (email: string) => {
  if (!db) return null;
  const rows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);
  return decryptUserRow(rows[0] ?? null);
};

export const createUser = async (
  email: string,
  displayName: string,
  passwordHash: string,
) => {
  if (!db) return null;
  const [row] = await db
    .insert(schema.users)
    .values({ email, displayName, passwordHash })
    .returning();
  return row;
};

export const getUserById = async (id: string) => {
  if (!db) return null;
  const rows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .limit(1);
  return decryptUserRow(rows[0] ?? null);
};

export const updateUserProfile = async (
  userId: string,
  patch: { displayName?: string; email?: string; avatarUrl?: string | null },
) => {
  if (!db) return null;
  const [updated] = await db
    .update(schema.users)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(schema.users.id, userId))
    .returning();
  return decryptUserRow(updated ?? null);
};

export const updateUserPasswordHash = async (
  userId: string,
  passwordHash: string,
) => {
  if (!db) return null;
  const [updated] = await db
    .update(schema.users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(schema.users.id, userId))
    .returning();
  return decryptUserRow(updated ?? null);
};

export const deleteUser = async (userId: string) => {
  if (!db) return false;
  return db.transaction(async (tx) => {
    const projectRows = await tx
      .select({ id: schema.projects.id })
      .from(schema.projects)
      .where(eq(schema.projects.ownerId, userId));
    const projectIds = projectRows.map((r) => r.id);
    if (projectIds.length > 0) {
      const sessionRows = await tx
        .select({ id: schema.agentSessions.id })
        .from(schema.agentSessions)
        .where(inArray(schema.agentSessions.projectId, projectIds));
      const sessionIds = sessionRows.map((r) => r.id);
      const turnRows = await tx
        .select({ id: schema.turns.id })
        .from(schema.turns)
        .where(inArray(schema.turns.projectId, projectIds));
      const turnIds = turnRows.map((r) => r.id);
      if (turnIds.length > 0) {
        await tx
          .delete(schema.turnEvents)
          .where(inArray(schema.turnEvents.turnId, turnIds));
        await tx.delete(schema.turns).where(inArray(schema.turns.id, turnIds));
      }
      if (sessionIds.length > 0) {
        await tx
          .delete(schema.toolCallCache)
          .where(inArray(schema.toolCallCache.sessionId, sessionIds));
        await tx
          .delete(schema.agentActions)
          .where(inArray(schema.agentActions.sessionId, sessionIds));
        await tx
          .delete(schema.agentSessions)
          .where(inArray(schema.agentSessions.id, sessionIds));
      }
      await tx.delete(schema.files).where(inArray(schema.files.projectId, projectIds));
      await tx
        .delete(schema.projectCheckpoints)
        .where(inArray(schema.projectCheckpoints.projectId, projectIds));
      await tx.delete(schema.projects).where(eq(schema.projects.ownerId, userId));
    }
    const deleted = await tx
      .delete(schema.users)
      .where(eq(schema.users.id, userId))
      .returning({ id: schema.users.id });
    return deleted.length > 0;
  });
};

export const setUserSupabaseIntegration = async (
  userId: string,
  integration: SupabaseAccountIntegration,
) => {
  if (!db) return null;
  const existing = await getUserById(userId);
  if (!existing) return null;
  const merged: UserIntegrations = {
    ...(existing.integrations ?? {}),
    supabase: integration,
  };
  const [updated] = await db
    .update(schema.users)
    .set({ integrations: encryptUserIntegrations(merged), updatedAt: new Date() })
    .where(eq(schema.users.id, userId))
    .returning();
  return decryptUserRow(updated ?? null);
};

export const clearUserSupabaseIntegration = async (userId: string) => {
  if (!db) return null;
  const existing = await getUserById(userId);
  if (!existing) return null;
  const current = existing.integrations ?? {};
  const { supabase: _drop, ...rest } = current;
  const nextIntegrations: UserIntegrations | null = Object.keys(rest).length
    ? rest
    : null;
  const [updated] = await db
    .update(schema.users)
    .set({
      integrations: nextIntegrations
        ? encryptUserIntegrations(nextIntegrations)
        : null,
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, userId))
    .returning();
  return decryptUserRow(updated ?? null);
};

export const setUserVercelIntegration = async (
  userId: string,
  integration: VercelAccountIntegration,
) => {
  if (!db) return null;
  const existing = await getUserById(userId);
  if (!existing) return null;
  const merged: UserIntegrations = {
    ...(existing.integrations ?? {}),
    vercel: integration,
  };
  const [updated] = await db
    .update(schema.users)
    .set({ integrations: encryptUserIntegrations(merged), updatedAt: new Date() })
    .where(eq(schema.users.id, userId))
    .returning();
  return decryptUserRow(updated ?? null);
};

export const clearUserVercelIntegration = async (userId: string) => {
  if (!db) return null;
  const existing = await getUserById(userId);
  if (!existing) return null;
  const current = existing.integrations ?? {};
  const { vercel: _drop, ...rest } = current;
  const nextIntegrations: UserIntegrations | null = Object.keys(rest).length
    ? rest
    : null;
  const [updated] = await db
    .update(schema.users)
    .set({
      integrations: nextIntegrations
        ? encryptUserIntegrations(nextIntegrations)
        : null,
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, userId))
    .returning();
  return decryptUserRow(updated ?? null);
};

export const setUserGitHubIntegration = async (
  userId: string,
  integration: GitHubAccountIntegration,
) => {
  if (!db) return null;
  const existing = await getUserById(userId);
  if (!existing) return null;
  const merged: UserIntegrations = {
    ...(existing.integrations ?? {}),
    github: integration,
  };
  const [updated] = await db
    .update(schema.users)
    .set({ integrations: encryptUserIntegrations(merged), updatedAt: new Date() })
    .where(eq(schema.users.id, userId))
    .returning();
  return decryptUserRow(updated ?? null);
};

export const clearUserGitHubIntegration = async (userId: string) => {
  if (!db) return null;
  const existing = await getUserById(userId);
  if (!existing) return null;
  const current = existing.integrations ?? {};
  const { github: _drop, ...rest } = current;
  const nextIntegrations: UserIntegrations | null = Object.keys(rest).length
    ? rest
    : null;
  const [updated] = await db
    .update(schema.users)
    .set({
      integrations: nextIntegrations
        ? encryptUserIntegrations(nextIntegrations)
        : null,
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, userId))
    .returning();
  return decryptUserRow(updated ?? null);
};

export const getUserProviderKey = async (
  userId: string,
  provider: keyof UserProviderKeys,
): Promise<ProviderKey | null> => {
  const user = await getUserById(userId);
  return user?.integrations?.providers?.[provider] ?? null;
};

export const setUserProviderKey = async (
  userId: string,
  provider: keyof UserProviderKeys,
  apiKey: string,
): Promise<boolean> => {
  if (!db) return false;
  const trimmed = apiKey.trim();
  if (!trimmed) throw new Error("apiKey must be non-empty");
  const existing = await getUserById(userId);
  if (!existing) return false;
  const current = existing.integrations ?? {};
  const providers: UserProviderKeys = { ...(current.providers ?? {}) };
  providers[provider] = {
    apiKey: trimmed,
    last4: trimmed.slice(-4),
    updatedAt: new Date().toISOString(),
  };
  const merged: UserIntegrations = { ...current, providers };
  await db
    .update(schema.users)
    .set({ integrations: encryptUserIntegrations(merged), updatedAt: new Date() })
    .where(eq(schema.users.id, userId));
  return true;
};

export const removeUserProviderKey = async (
  userId: string,
  provider: keyof UserProviderKeys,
): Promise<boolean> => {
  if (!db) return false;
  const existing = await getUserById(userId);
  if (!existing?.integrations?.providers?.[provider]) return false;
  const current = existing.integrations;
  const { [provider]: _drop, ...restProviders } = current.providers ?? {};
  const nextProviders = Object.keys(restProviders).length ? restProviders : undefined;
  const nextIntegrations: UserIntegrations = { ...current };
  if (nextProviders) nextIntegrations.providers = nextProviders;
  else delete nextIntegrations.providers;
  const isEmpty = Object.keys(nextIntegrations).length === 0;
  await db
    .update(schema.users)
    .set({
      integrations: isEmpty ? null : encryptUserIntegrations(nextIntegrations),
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, userId));
  return true;
};
