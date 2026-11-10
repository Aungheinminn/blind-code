import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "../client";

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

export const hasRunningTurn = async (projectId: string): Promise<boolean> => {
  if (!db) return false;
  const rows = await db
    .select({ id: schema.turns.id })
    .from(schema.turns)
    .where(and(eq(schema.turns.projectId, projectId), eq(schema.turns.status, "running")))
    .limit(1);
  return rows.length > 0;
};

const CHECKPOINTS_PER_PROJECT = 50;

export const createProjectCheckpoint = async (projectId: string, sessionId: string) => {
  if (!db) return;
  const rows = await listProjectFiles(projectId);
  const files: Record<string, string> = {};
  for (const f of rows) if (!f.isDirectory) files[f.path] = f.content;
  await db.insert(schema.projectCheckpoints).values({ projectId, sessionId, files });

  const stale = await db
    .select({ id: schema.projectCheckpoints.id })
    .from(schema.projectCheckpoints)
    .where(eq(schema.projectCheckpoints.projectId, projectId))
    .orderBy(desc(schema.projectCheckpoints.createdAt))
    .offset(CHECKPOINTS_PER_PROJECT);
  if (stale.length > 0) {
    await db.delete(schema.projectCheckpoints).where(
      inArray(
        schema.projectCheckpoints.id,
        stale.map((r) => r.id),
      ),
    );
  }
};

// Replaces every project file with the checkpoint's snapshot. Returns the
// restored files, or null when the checkpoint doesn't belong to the project.
export const restoreProjectCheckpoint = async (
  projectId: string,
  sessionId: string,
): Promise<Record<string, string> | null> => {
  if (!db) return null;
  const [checkpoint] = await db
    .select()
    .from(schema.projectCheckpoints)
    .where(
      and(
        eq(schema.projectCheckpoints.projectId, projectId),
        eq(schema.projectCheckpoints.sessionId, sessionId),
      ),
    )
    .limit(1);
  if (!checkpoint) return null;

  const entries = Object.entries(checkpoint.files);
  await db.transaction(async (tx) => {
    await tx.delete(schema.files).where(eq(schema.files.projectId, projectId));
    if (entries.length > 0) {
      await tx.insert(schema.files).values(
        entries.map(([path, content]) => ({
          projectId,
          path,
          content,
          sizeBytes: Buffer.byteLength(content, "utf-8"),
        })),
      );
    }
  });
  return checkpoint.files;
};
