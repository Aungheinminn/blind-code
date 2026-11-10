import { and, asc, desc, eq } from "drizzle-orm";
import { db, schema } from "../client";

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
