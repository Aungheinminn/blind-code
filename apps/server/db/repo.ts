import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db, hasDb, schema } from "./client";
import type {
  ProjectIntegrations,
  SupabaseAccountIntegration,
  SupabaseIntegration,
  UserIntegrations,
} from "@vibe/shared";
import { isUuid, stringToUuid } from "../services/uuid";
import { encrypt, decryptMaybe } from "../services/crypto";

const encryptUserIntegrations = (
  integrations: UserIntegrations,
): UserIntegrations => {
  if (!integrations.supabase) return integrations;
  return {
    ...integrations,
    supabase: {
      ...integrations.supabase,
      accessToken: encrypt(integrations.supabase.accessToken),
    },
  };
};

const decryptUserIntegrations = (
  integrations: UserIntegrations | null | undefined,
): UserIntegrations | null => {
  if (!integrations) return null;
  if (!integrations.supabase) return integrations;
  const at = decryptMaybe(integrations.supabase.accessToken);
  return {
    ...integrations,
    supabase: { ...integrations.supabase, accessToken: at ?? "" },
  };
};

const decryptUserRow = <T extends { integrations?: UserIntegrations | null }>(
  row: T | null | undefined,
): T | null => {
  if (!row) return null;
  return { ...row, integrations: decryptUserIntegrations(row.integrations) };
};

const encryptProjectIntegrations = (
  integrations: ProjectIntegrations,
): ProjectIntegrations => {
  if (!integrations.supabase) return integrations;
  const s = integrations.supabase;
  return {
    ...integrations,
    supabase: {
      ...s,
      serviceRoleKey: s.serviceRoleKey ? encrypt(s.serviceRoleKey) : undefined,
      databaseUrl: s.databaseUrl ? encrypt(s.databaseUrl) : undefined,
    },
  };
};

const decryptProjectIntegrations = (
  integrations: ProjectIntegrations | null | undefined,
): ProjectIntegrations | null => {
  if (!integrations) return null;
  if (!integrations.supabase) return integrations;
  const s = integrations.supabase;
  return {
    ...integrations,
    supabase: {
      ...s,
      serviceRoleKey: s.serviceRoleKey
        ? (decryptMaybe(s.serviceRoleKey) ?? undefined)
        : undefined,
      databaseUrl: s.databaseUrl
        ? (decryptMaybe(s.databaseUrl) ?? undefined)
        : undefined,
    },
  };
};

const decryptProjectRow = <
  T extends { integrations?: ProjectIntegrations | null },
>(
  row: T | null | undefined,
): T | null => {
  if (!row) return null;
  return { ...row, integrations: decryptProjectIntegrations(row.integrations) };
};

const projectIdFor = (idOrName: string, ownerId: string): string =>
  isUuid(idOrName) ? idOrName.toLowerCase() : stringToUuid(`${ownerId}:${idOrName}`);

export const resolveProjectId = projectIdFor;

export const findProjectByOwnerAndSupabaseRef = async (
  ownerId: string,
  projectRef: string,
  exceptId?: string,
): Promise<{ id: string; name: string } | null> => {
  if (!db) return null;
  const rows = await db
    .select({ id: schema.projects.id, name: schema.projects.name })
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.ownerId, ownerId),
        sql`${schema.projects.integrations}->'supabase'->>'projectRef' = ${projectRef}`,
      ),
    );
  const conflict = rows.find((r) => (exceptId ? r.id !== exceptId : true));
  return conflict ?? null;
};

export const listAttachedSupabaseRefsForOwner = async (
  ownerId: string,
): Promise<string[]> => {
  if (!db) return [];
  const rows = await db
    .select({
      ref: sql<string | null>`${schema.projects.integrations}->'supabase'->>'projectRef'`,
    })
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.ownerId, ownerId),
        sql`${schema.projects.integrations}->'supabase'->>'projectRef' IS NOT NULL`,
      ),
    );
  return [...new Set(rows.map((r) => r.ref).filter((v): v is string => Boolean(v)))];
};

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

  return {
    items: items.map((r) => decryptProjectRow(r)!),
    total: Number(count) || 0,
    page,
    pageSize,
  };
};

export const getProjectForOwner = async (idOrName: string, ownerId: string) => {
  if (!db) return null;
  const id = projectIdFor(idOrName, ownerId);
  const rows = await db
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.id, id), eq(schema.projects.ownerId, ownerId)))
    .limit(1);
  return decryptProjectRow(rows[0] ?? null);
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
  return decryptProjectRow(updated ?? null);
};

export const setSupabaseIntegrationForOwner = async (
  idOrName: string,
  ownerId: string,
  integration: SupabaseIntegration,
) => {
  if (!db) return null;
  const id = projectIdFor(idOrName, ownerId);
  const existing = await db
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.id, id), eq(schema.projects.ownerId, ownerId)))
    .limit(1);
  if (!existing[0]) return null;
  const decryptedExisting = decryptProjectRow(existing[0])!;
  const merged: ProjectIntegrations = {
    ...(decryptedExisting.integrations ?? {}),
    supabase: integration,
  };
  const [updated] = await db
    .update(schema.projects)
    .set({
      integrations: encryptProjectIntegrations(merged),
      updatedAt: new Date(),
    })
    .where(and(eq(schema.projects.id, id), eq(schema.projects.ownerId, ownerId)))
    .returning();
  return decryptProjectRow(updated ?? null);
};

export const clearSupabaseIntegrationsByRefForOwner = async (
  ownerId: string,
  projectRef: string,
): Promise<number> => {
  if (!db) return 0;
  const rows = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.ownerId, ownerId));
  let cleared = 0;
  for (const row of rows) {
    // projectRef isn't encrypted, so this match works on the raw row.
    if (row.integrations?.supabase?.projectRef !== projectRef) continue;
    const current = row.integrations ?? {};
    const { supabase: _drop, ...rest } = current;
    const nextIntegrations: ProjectIntegrations | null = Object.keys(rest).length
      ? rest
      : null;
    await db
      .update(schema.projects)
      .set({
        integrations: nextIntegrations
          ? encryptProjectIntegrations(nextIntegrations)
          : null,
        updatedAt: new Date(),
      })
      .where(and(eq(schema.projects.id, row.id), eq(schema.projects.ownerId, ownerId)));
    cleared++;
  }
  return cleared;
};

export const clearSupabaseIntegrationForOwner = async (
  idOrName: string,
  ownerId: string,
) => {
  if (!db) return null;
  const id = projectIdFor(idOrName, ownerId);
  const existing = await db
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.id, id), eq(schema.projects.ownerId, ownerId)))
    .limit(1);
  if (!existing[0]) return null;
  const current = existing[0].integrations ?? {};
  const { supabase: _drop, ...rest } = current;
  const nextIntegrations: ProjectIntegrations | null = Object.keys(rest).length
    ? rest
    : null;
  const [updated] = await db
    .update(schema.projects)
    .set({
      integrations: nextIntegrations
        ? encryptProjectIntegrations(nextIntegrations)
        : null,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.projects.id, id), eq(schema.projects.ownerId, ownerId)))
    .returning();
  return decryptProjectRow(updated ?? null);
};

export const deleteProjectForOwner = async (idOrName: string, ownerId: string) => {
  if (!db) return false;
  const id = projectIdFor(idOrName, ownerId);
  return db.transaction(async (tx) => {
    const project = await tx
      .select({ id: schema.projects.id })
      .from(schema.projects)
      .where(and(eq(schema.projects.id, id), eq(schema.projects.ownerId, ownerId)))
      .limit(1);
    if (!project[0]) return false;

    const sessionRows = await tx
      .select({ id: schema.agentSessions.id })
      .from(schema.agentSessions)
      .where(eq(schema.agentSessions.projectId, id));
    const sessionIds = sessionRows.map((r) => r.id);

    const turnRows = await tx
      .select({ id: schema.turns.id })
      .from(schema.turns)
      .where(eq(schema.turns.projectId, id));
    const turnIds = turnRows.map((r) => r.id);

    if (turnIds.length > 0) {
      await tx.delete(schema.turnEvents).where(inArray(schema.turnEvents.turnId, turnIds));
      await tx.delete(schema.turns).where(inArray(schema.turns.id, turnIds));
    }
    if (sessionIds.length > 0) {
      await tx.delete(schema.toolCallCache).where(inArray(schema.toolCallCache.sessionId, sessionIds));
      await tx.delete(schema.agentActions).where(inArray(schema.agentActions.sessionId, sessionIds));
      await tx.delete(schema.agentSessions).where(inArray(schema.agentSessions.id, sessionIds));
    }
    await tx.delete(schema.files).where(eq(schema.files.projectId, id));
    await tx
      .delete(schema.projects)
      .where(and(eq(schema.projects.id, id), eq(schema.projects.ownerId, ownerId)));
    return true;
  });
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
  interrupted?: boolean;
};

export const getProjectHistory = async (projectId: string): Promise<HistoryMessage[]> => {
  if (!db) return [];
  const rows = await db
    .select({
      id: schema.agentActions.id,
      sessionId: schema.agentActions.sessionId,
      actionType: schema.agentActions.actionType,
      payload: schema.agentActions.payload,
      createdAt: schema.agentActions.createdAt,
      turnStatus: schema.turns.status,
    })
    .from(schema.agentActions)
    .innerJoin(
      schema.agentSessions,
      eq(schema.agentSessions.id, schema.agentActions.sessionId),
    )
    .leftJoin(schema.turns, eq(schema.turns.sessionId, schema.agentActions.sessionId))
    .where(eq(schema.agentSessions.projectId, projectId))
    .orderBy(asc(schema.agentActions.createdAt), asc(schema.agentActions.id));

  type SessionBucket = {
    sessionId: string;
    cancelled: boolean;
    rows: typeof rows;
    firstAt: string;
  };
  const bySession = new Map<string, SessionBucket>();
  for (const row of rows) {
    let bucket = bySession.get(row.sessionId);
    if (!bucket) {
      bucket = {
        sessionId: row.sessionId,
        cancelled: row.turnStatus === "cancelled",
        rows: [],
        firstAt: row.createdAt.toISOString(),
      };
      bySession.set(row.sessionId, bucket);
    }
    bucket.rows.push(row);
  }

  const sessions = [...bySession.values()].sort((a, b) =>
    a.firstAt < b.firstAt ? -1 : a.firstAt > b.firstAt ? 1 : 0,
  );

  const messages: HistoryMessage[] = [];

  for (const session of sessions) {
    let agent: HistoryMessage | null = null;
    let text = "";

    const ensureAgent = (id: string, timestamp: string) => {
      if (agent) return;
      agent = { id, role: "agent", content: "", parts: [], timestamp };
      if (session.cancelled) agent.interrupted = true;
      messages.push(agent);
    };

    let lastTimestamp = session.firstAt;

    for (const row of session.rows) {
      const payload = (row.payload ?? {}) as Record<string, unknown>;
      const timestamp = row.createdAt.toISOString();
      lastTimestamp = timestamp;

      if (row.actionType === "user_prompt") {
        messages.push({
          id: row.id,
          role: "user",
          content: typeof payload.prompt === "string" ? payload.prompt : "",
          timestamp,
        });
        continue;
      }

      ensureAgent(row.id, timestamp);
      const a = agent!;
      a.parts ??= [];

      if (row.actionType === "assistant_text") {
        const t = typeof payload.text === "string" ? payload.text : "";
        if (!t) continue;
        a.parts.push({ kind: "text", text: t });
        text += (text ? "\n\n" : "") + t;
        a.content = text;
        continue;
      }

      if (row.actionType === "assistant_reasoning") {
        const t = typeof payload.text === "string" ? payload.text : "";
        if (!t) continue;
        a.parts.push({ kind: "reasoning", text: t });
        continue;
      }

      if (row.actionType.startsWith("tool_call:")) {
        const toolCallId =
          typeof payload.toolCallId === "string" ? payload.toolCallId : row.id;
        const name = row.actionType.slice("tool_call:".length);
        a.parts.push({
          kind: "tool",
          id: toolCallId,
          name,
          input: payload.input,
        });
        continue;
      }

      if (row.actionType.startsWith("tool_result:")) {
        const toolCallId =
          typeof payload.toolCallId === "string" ? payload.toolCallId : null;
        if (!toolCallId) continue;
        const tool = [...a.parts].reverse().find(
          (p) => p.kind === "tool" && p.id === toolCallId,
        );
        if (tool && tool.kind === "tool") tool.output = payload.output;
        continue;
      }
    }

    if (session.cancelled && !agent) {
      messages.push({
        id: `${session.sessionId}-interrupted`,
        role: "agent",
        content: "",
        parts: [],
        timestamp: lastTimestamp,
        interrupted: true,
      });
    }
  }

  return messages.filter(
    (m) => m.content.length > 0 || (m.parts && m.parts.length > 0) || m.interrupted,
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

export type PlanSnapshot = {
  id: string;
  summary: string;
  todos: Array<{
    id: string;
    title: string;
    rationale: string;
    status: schema.PlanTodoStatus;
    note: string | null;
  }>;
};

type IncomingPlan = {
  summary: string;
  todos: Array<{ id: string; title: string; rationale?: string }>;
};

export const createPlan = async (
  projectId: string,
  sessionId: string,
  plan: IncomingPlan,
): Promise<string | null> => {
  if (!db) return null;
  const [row] = await db
    .insert(schema.plans)
    .values({ projectId, sessionId, summary: plan.summary })
    .returning({ id: schema.plans.id });
  if (!row) return null;
  const planId = row.id;

  if (plan.todos.length > 0) {
    await db.insert(schema.planTodos).values(
      plan.todos.map((t, i) => ({
        planId,
        todoKey: t.id,
        title: t.title,
        rationale: t.rationale ?? "",
        orderIndex: i,
      })),
    );
  }
  return planId;
};

export const updateTodoStatus = async (
  sessionId: string,
  todoKey: string,
  status: schema.PlanTodoStatus,
  note?: string,
): Promise<void> => {
  if (!db) return;
  const [session] = await db
    .select({ projectId: schema.agentSessions.projectId })
    .from(schema.agentSessions)
    .where(eq(schema.agentSessions.id, sessionId))
    .limit(1);
  if (!session) return;
  const [latest] = await db
    .select({ id: schema.plans.id })
    .from(schema.plans)
    .where(eq(schema.plans.projectId, session.projectId))
    .orderBy(desc(schema.plans.createdAt))
    .limit(1);
  if (!latest) return;
  await db
    .update(schema.planTodos)
    .set({ status, ...(note !== undefined ? { note } : {}) })
    .where(
      and(
        eq(schema.planTodos.planId, latest.id),
        eq(schema.planTodos.todoKey, todoKey),
      ),
    );
};

export const getLatestPlanForProject = async (
  projectId: string,
): Promise<PlanSnapshot | null> => {
  if (!db) return null;
  const [plan] = await db
    .select({
      id: schema.plans.id,
      summary: schema.plans.summary,
    })
    .from(schema.plans)
    .where(eq(schema.plans.projectId, projectId))
    .orderBy(desc(schema.plans.createdAt))
    .limit(1);
  if (!plan) return null;

  const todos = await db
    .select({
      id: schema.planTodos.todoKey,
      title: schema.planTodos.title,
      rationale: schema.planTodos.rationale,
      status: schema.planTodos.status,
      note: schema.planTodos.note,
    })
    .from(schema.planTodos)
    .where(eq(schema.planTodos.planId, plan.id))
    .orderBy(asc(schema.planTodos.orderIndex));

  return { id: plan.id, summary: plan.summary, todos };
};

export const addTodoToLatestPlan = async (
  projectId: string,
  todo: { title: string; rationale?: string },
): Promise<{ id: string; title: string; rationale: string } | null> => {
  if (!db) return null;
  const [latest] = await db
    .select({ id: schema.plans.id })
    .from(schema.plans)
    .where(eq(schema.plans.projectId, projectId))
    .orderBy(desc(schema.plans.createdAt))
    .limit(1);
  if (!latest) return null;

  const existing = await db
    .select({
      todoKey: schema.planTodos.todoKey,
      orderIndex: schema.planTodos.orderIndex,
    })
    .from(schema.planTodos)
    .where(eq(schema.planTodos.planId, latest.id));

  let maxN = 0;
  let maxOrder = -1;
  for (const row of existing) {
    const m = row.todoKey.match(/^t(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxN) maxN = n;
    }
    if (row.orderIndex > maxOrder) maxOrder = row.orderIndex;
  }
  const nextKey = `t${maxN + 1}`;
  const nextOrder = maxOrder + 1;
  const rationale = todo.rationale ?? "";

  await db.insert(schema.planTodos).values({
    planId: latest.id,
    todoKey: nextKey,
    title: todo.title,
    rationale,
    orderIndex: nextOrder,
  });

  return { id: nextKey, title: todo.title, rationale };
};

export { hasDb };
