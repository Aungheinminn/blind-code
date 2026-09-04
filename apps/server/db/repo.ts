import { and, eq } from "drizzle-orm";
import { db, hasDb, schema } from "./client";
import { isUuid, stringToUuid } from "../services/uuid";

const projectIdFor = (idOrName: string, ownerId: string): string =>
  isUuid(idOrName) ? idOrName.toLowerCase() : stringToUuid(`${ownerId}:${idOrName}`);

export const findUserByEmail = async (email: string) => {
  if (!db) return null;
  const rows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);
  return rows[0] ?? null;
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

export const ensureProject = async (
  projectIdOrName: string,
  ownerId: string,
): Promise<{ id: string; created: boolean; forbidden?: boolean } | null> => {
  if (!db) return null;
  const id = projectIdFor(projectIdOrName, ownerId);
  const found = await db.select().from(schema.projects).where(eq(schema.projects.id, id)).limit(1);
  if (found[0]) {
    if (found[0].ownerId !== ownerId) return { id, created: false, forbidden: true };
    return { id: found[0].id, created: false };
  }

  const [created] = await db
    .insert(schema.projects)
    .values({ id, ownerId, name: projectIdOrName })
    .returning();
  return { id: created.id, created: true };
};

export const listProjectsForOwner = async (ownerId: string) => {
  if (!db) return [];
  return db.select().from(schema.projects).where(eq(schema.projects.ownerId, ownerId));
};

export const getProjectForOwner = async (idOrName: string, ownerId: string) => {
  if (!db) return null;
  const id = projectIdFor(idOrName, ownerId);
  const rows = await db
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.id, id), eq(schema.projects.ownerId, ownerId)))
    .limit(1);
  return rows[0] ?? null;
};

export const updateProjectForOwner = async (
  idOrName: string,
  ownerId: string,
  patch: Partial<{ name: string; description: string | null; isArchived: boolean }>,
) => {
  if (!db) return null;
  const id = projectIdFor(idOrName, ownerId);
  const [updated] = await db
    .update(schema.projects)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(schema.projects.id, id), eq(schema.projects.ownerId, ownerId)))
    .returning();
  return updated ?? null;
};

export const deleteProjectForOwner = async (idOrName: string, ownerId: string) => {
  if (!db) return false;
  const id = projectIdFor(idOrName, ownerId);
  const res = await db
    .delete(schema.projects)
    .where(and(eq(schema.projects.id, id), eq(schema.projects.ownerId, ownerId)))
    .returning();
  return res.length > 0;
};

export const createAgentSession = async (projectId: string, model: string): Promise<string | null> => {
  if (!db) return null;
  const [row] = await db
    .insert(schema.agentSessions)
    .values({ projectId, model })
    .returning();
  return row.id;
};

export const endAgentSession = async (sessionId: string) => {
  if (!db) return;
  await db
    .update(schema.agentSessions)
    .set({ endedAt: new Date() })
    .where(eq(schema.agentSessions.id, sessionId));
};

export const recordAgentAction = async (
  sessionId: string,
  actionType: string,
  data: {
    summary?: string;
    payload?: Record<string, unknown>;
    stdout?: string;
    stderr?: string;
  },
) => {
  if (!db) return;
  await db.insert(schema.agentActions).values({
    sessionId,
    actionType,
    summary: data.summary ?? null,
    payload: data.payload ?? null,
    stdout: data.stdout ?? null,
    stderr: data.stderr ?? null,
  });
};

export const listProjectFiles = async (projectId: string) => {
  if (!db) return [];
  return db.select().from(schema.files).where(eq(schema.files.projectId, projectId));
};

export const upsertProjectFile = async (
  projectId: string,
  path: string,
  content: string,
) => {
  if (!db) return;
  const existing = await db
    .select()
    .from(schema.files)
    .where(and(eq(schema.files.projectId, projectId), eq(schema.files.path, path)))
    .limit(1);
  const sizeBytes = Buffer.byteLength(content, "utf-8");
  if (existing[0]) {
    await db
      .update(schema.files)
      .set({ content, sizeBytes, updatedAt: new Date() })
      .where(eq(schema.files.id, existing[0].id));
  } else {
    await db.insert(schema.files).values({ projectId, path, content, sizeBytes });
  }
};

export const deleteProjectFile = async (projectId: string, path: string) => {
  if (!db) return;
  await db
    .delete(schema.files)
    .where(and(eq(schema.files.projectId, projectId), eq(schema.files.path, path)));
};

export const getCachedToolResult = async (
  sessionId: string,
  toolCallId: string,
): Promise<{ result: unknown; inputHash: string } | null> => {
  if (!db) return null;
  const rows = await db
    .select()
    .from(schema.toolCallCache)
    .where(
      and(
        eq(schema.toolCallCache.sessionId, sessionId),
        eq(schema.toolCallCache.toolCallId, toolCallId),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { result: row.result, inputHash: row.inputHash };
};

export const putCachedToolResult = async (
  sessionId: string,
  toolCallId: string,
  toolName: string,
  inputHash: string,
  result: unknown,
) => {
  if (!db) return;
  await db
    .insert(schema.toolCallCache)
    .values({ sessionId, toolCallId, toolName, inputHash, result })
    .onConflictDoNothing({
      target: [schema.toolCallCache.sessionId, schema.toolCallCache.toolCallId],
    });
};

export { hasDb };
