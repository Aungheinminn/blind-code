import { and, eq } from "drizzle-orm";
import { db, hasDb, schema } from "./client";
import { stringToUuid } from "../services/uuid";

const LOCAL_USER_EMAIL = "local@vibe-code.dev";
let cachedLocalUserId: string | null = null;

export const ensureLocalUser = async (): Promise<string | null> => {
  if (!db) return null;
  if (cachedLocalUserId) return cachedLocalUserId;

  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, LOCAL_USER_EMAIL))
    .limit(1);

  if (existing[0]) {
    cachedLocalUserId = existing[0].id;
    return cachedLocalUserId;
  }

  const [created] = await db
    .insert(schema.users)
    .values({ email: LOCAL_USER_EMAIL, displayName: "Local" })
    .returning();
  cachedLocalUserId = created.id;
  return cachedLocalUserId;
};

export const ensureProject = async (
  projectIdOrName: string,
): Promise<{ id: string; created: boolean } | null> => {
  if (!db) return null;
  const id = stringToUuid(projectIdOrName);
  const found = await db.select().from(schema.projects).where(eq(schema.projects.id, id)).limit(1);
  if (found[0]) return { id: found[0].id, created: false };

  const ownerId = await ensureLocalUser();
  if (!ownerId) return null;

  const [created] = await db
    .insert(schema.projects)
    .values({ id, ownerId, name: projectIdOrName })
    .returning();
  return { id: created.id, created: true };
};

export const listProjects = async () => {
  if (!db) return [];
  return db.select().from(schema.projects);
};

export const getProject = async (idOrName: string) => {
  if (!db) return null;
  const id = stringToUuid(idOrName);
  const rows = await db.select().from(schema.projects).where(eq(schema.projects.id, id)).limit(1);
  return rows[0] ?? null;
};

export const updateProject = async (
  idOrName: string,
  patch: Partial<{ name: string; description: string | null; isArchived: boolean }>,
) => {
  if (!db) return null;
  const id = stringToUuid(idOrName);
  const [updated] = await db
    .update(schema.projects)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(schema.projects.id, id))
    .returning();
  return updated ?? null;
};

export const deleteProject = async (idOrName: string) => {
  if (!db) return false;
  const id = stringToUuid(idOrName);
  const res = await db.delete(schema.projects).where(eq(schema.projects.id, id)).returning();
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

export { hasDb };
