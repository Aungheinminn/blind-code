import { asc, eq } from "drizzle-orm";
import { db, schema } from "../client";

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
  | { kind: "tool"; id: string; name: string; input: unknown; output?: unknown };

export type HistoryUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type HistoryMessage = {
  id: string;
  role: "user" | "agent";
  content: string;
  parts?: HistoryPart[];
  timestamp: string;
  interrupted?: boolean;
  usage?: HistoryUsage;
  checkpointId?: string;
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

  const checkpointRows = await db
    .select({ sessionId: schema.projectCheckpoints.sessionId })
    .from(schema.projectCheckpoints)
    .where(eq(schema.projectCheckpoints.projectId, projectId));
  const checkpointSessions = new Set(checkpointRows.map((r) => r.sessionId));

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
          ...(checkpointSessions.has(session.sessionId) ? { checkpointId: session.sessionId } : {}),
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
        // Legacy: older sessions persisted reasoning blocks; reasoning is no
        // longer surfaced in the UI, so drop them on hydration.
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

      if (row.actionType === "finish") {
        const u = payload.usage;
        if (!u || typeof u !== "object") continue;
        const uo = u as Record<string, unknown>;
        const read = (...keys: string[]): number => {
          for (const k of keys) {
            const v = uo[k];
            if (typeof v === "number" && Number.isFinite(v)) return v;
          }
          return 0;
        };
        const input = read("inputTokens", "promptTokens");
        const output = read("outputTokens", "completionTokens");
        const total = read("totalTokens") || input + output;
        if (total <= 0) continue;
        const prev = a.usage ?? { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
        a.usage = {
          inputTokens: prev.inputTokens + input,
          outputTokens: prev.outputTokens + output,
          totalTokens: prev.totalTokens + total,
        };
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
