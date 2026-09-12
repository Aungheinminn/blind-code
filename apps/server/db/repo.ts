import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
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
  opts: { description?: string | null } = {},
): Promise<{ id: string; created: boolean; forbidden?: boolean } | null> => {
  if (!db) return null;
  const id = projectIdFor(projectIdOrName, ownerId);
  const found = await db.select().from(schema.projects).where(eq(schema.projects.id, id)).limit(1);
  if (found[0]) {
    if (found[0].ownerId !== ownerId) return { id, created: false, forbidden: true };
    return { id: found[0].id, created: false };
  }

  const description =
    typeof opts.description === "string" && opts.description.trim().length > 0
      ? opts.description
      : null;

  const [created] = await db
    .insert(schema.projects)
    .values({ id, ownerId, name: projectIdOrName, description })
    .returning();
  return { id: created.id, created: true };
};

export const listProjectsForOwner = async (
  ownerId: string,
  opts: { q?: string; page?: number; pageSize?: number } = {},
) => {
  if (!db) return { items: [], total: 0, page: 1, pageSize: opts.pageSize ?? 12 };
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(opts.pageSize ?? 12)));
  const q = (opts.q ?? "").trim();

  const ownerFilter = eq(schema.projects.ownerId, ownerId);
  const searchFilter = q
    ? or(
        ilike(schema.projects.name, `%${q}%`),
        ilike(schema.projects.description, `%${q}%`),
      )
    : undefined;
  const where = searchFilter ? and(ownerFilter, searchFilter) : ownerFilter;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.projects)
    .where(where);

  const items = await db
    .select()
    .from(schema.projects)
    .where(where)
    .orderBy(desc(schema.projects.updatedAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return { items, total: Number(count) || 0, page, pageSize };
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

export type HistoryPart =
  | { kind: "text"; text: string }
  | { kind: "reasoning"; text: string }
  | { kind: "tool"; id: string; name: string; input: unknown; output?: unknown };

export type HistoryMessage = {
  id: string;
  role: "user" | "agent";
  content: string;
  parts?: HistoryPart[];
  timestamp: string;
};

export const getProjectHistory = async (projectId: string): Promise<HistoryMessage[]> => {
  if (!db) return [];
  const rows = await db
    .select({
      id: schema.agentActions.id,
      actionType: schema.agentActions.actionType,
      payload: schema.agentActions.payload,
      createdAt: schema.agentActions.createdAt,
    })
    .from(schema.agentActions)
    .innerJoin(
      schema.agentSessions,
      eq(schema.agentSessions.id, schema.agentActions.sessionId),
    )
    .where(eq(schema.agentSessions.projectId, projectId))
    .orderBy(asc(schema.agentActions.createdAt), asc(schema.agentActions.id));

  const messages: HistoryMessage[] = [];
  let currentAgent: HistoryMessage | null = null;
  let currentText = "";

  const startAgent = (id: string, timestamp: string) => {
    currentText = "";
    currentAgent = {
      id,
      role: "agent",
      content: "",
      parts: [],
      timestamp,
    };
    messages.push(currentAgent);
  };

  for (const row of rows) {
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    const timestamp = row.createdAt.toISOString();

    if (row.actionType === "user_prompt") {
      currentAgent = null;
      currentText = "";
      messages.push({
        id: row.id,
        role: "user",
        content: typeof payload.prompt === "string" ? payload.prompt : "",
        timestamp,
      });
      continue;
    }

    if (!currentAgent) startAgent(row.id, timestamp);
    const agent = currentAgent!;
    agent.parts ??= [];

    if (row.actionType === "assistant_text") {
      const text = typeof payload.text === "string" ? payload.text : "";
      if (!text) continue;
      agent.parts.push({ kind: "text", text });
      currentText += (currentText ? "\n\n" : "") + text;
      agent.content = currentText;
      continue;
    }

    if (row.actionType === "assistant_reasoning") {
      const text = typeof payload.text === "string" ? payload.text : "";
      if (!text) continue;
      agent.parts.push({ kind: "reasoning", text });
      continue;
    }

    if (row.actionType.startsWith("tool_call:")) {
      const toolCallId = typeof payload.toolCallId === "string" ? payload.toolCallId : row.id;
      const name = row.actionType.slice("tool_call:".length);
      agent.parts.push({
        kind: "tool",
        id: toolCallId,
        name,
        input: payload.input,
      });
      continue;
    }

    if (row.actionType.startsWith("tool_result:")) {
      const toolCallId = typeof payload.toolCallId === "string" ? payload.toolCallId : null;
      if (!toolCallId) continue;
      const tool = [...agent.parts].reverse().find(
        (p) => p.kind === "tool" && p.id === toolCallId,
      );
      if (tool && tool.kind === "tool") tool.output = payload.output;
      continue;
    }
  }

  return messages.filter(
    (m) => m.content.length > 0 || (m.parts && m.parts.length > 0),
  );
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
