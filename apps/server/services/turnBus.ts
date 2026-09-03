import { and, asc, eq, gt, inArray, lt, sql } from "drizzle-orm";
import { db, hasDb, schema } from "../db/client";

const incrementOrdinal = () => sql`${schema.turns.nextEventOrdinal} + 1`;

export type TurnStatus = "running" | "done" | "failed" | "cancelled";

export type TurnEventPayload = { type: string } & Record<string, unknown>;

export type TurnEventRecord = {
  ordinal: number;
  payload: TurnEventPayload;
};

type Subscriber = (record: TurnEventRecord) => void;

const liveSubscribers = new Map<string, Set<Subscriber>>();

export const turnBus = {
  hasDb: () => hasDb,

  async createTurn(sessionId: string, projectId: string): Promise<string | null> {
    if (!db) return null;
    const [row] = await db
      .insert(schema.turns)
      .values({ sessionId, projectId })
      .returning();
    return row.id;
  },

  async emit(turnId: string, payload: TurnEventPayload): Promise<number | null> {
    if (!db) {
      fanout(turnId, { ordinal: -1, payload });
      return null;
    }

    const [updated] = await db
      .update(schema.turns)
      .set({ nextEventOrdinal: incrementOrdinal() })
      .where(eq(schema.turns.id, turnId))
      .returning({ nextEventOrdinal: schema.turns.nextEventOrdinal });

    if (!updated) return null;
    const ordinal = updated.nextEventOrdinal - 1;

    await db.insert(schema.turnEvents).values({ turnId, ordinal, payload });
    fanout(turnId, { ordinal, payload });
    return ordinal;
  },

  async finishTurn(
    turnId: string,
    status: Exclude<TurnStatus, "running">,
    lastError?: string | null,
  ): Promise<void> {
    if (!db) return;
    await db
      .update(schema.turns)
      .set({ status, endedAt: new Date(), lastError: lastError ?? null })
      .where(eq(schema.turns.id, turnId));
  },

  async getEventsSince(turnId: string, afterOrdinal: number): Promise<TurnEventRecord[]> {
    if (!db) return [];
    const rows = await db
      .select({ ordinal: schema.turnEvents.ordinal, payload: schema.turnEvents.payload })
      .from(schema.turnEvents)
      .where(
        and(eq(schema.turnEvents.turnId, turnId), gt(schema.turnEvents.ordinal, afterOrdinal)),
      )
      .orderBy(asc(schema.turnEvents.ordinal));
    return rows.map((r) => ({ ordinal: r.ordinal, payload: r.payload as TurnEventPayload }));
  },

  async getTurn(turnId: string) {
    if (!db) return null;
    const rows = await db.select().from(schema.turns).where(eq(schema.turns.id, turnId)).limit(1);
    return rows[0] ?? null;
  },

  subscribe(turnId: string, listener: Subscriber): () => void {
    let set = liveSubscribers.get(turnId);
    if (!set) {
      set = new Set();
      liveSubscribers.set(turnId, set);
    }
    set.add(listener);
    return () => {
      const s = liveSubscribers.get(turnId);
      if (!s) return;
      s.delete(listener);
      if (s.size === 0) liveSubscribers.delete(turnId);
    };
  },

  isLive(turnId: string): boolean {
    return liveSubscribers.has(turnId);
  },

  async sweepOrphanedRunning(olderThanMs: number = 60_000): Promise<number> {
    if (!db) return 0;
    const cutoff = new Date(Date.now() - olderThanMs);
    const rows = await db
      .select({ id: schema.turns.id })
      .from(schema.turns)
      .where(and(eq(schema.turns.status, "running"), lt(schema.turns.startedAt, cutoff)));
    if (rows.length === 0) return 0;
    await db
      .update(schema.turns)
      .set({ status: "failed", endedAt: new Date(), lastError: "server_restart" })
      .where(
        inArray(
          schema.turns.id,
          rows.map((r) => r.id),
        ),
      );
    return rows.length;
  },
};

const fanout = (turnId: string, record: TurnEventRecord) => {
  const subs = liveSubscribers.get(turnId);
  if (!subs) return;
  for (const fn of subs) {
    try {
      fn(record);
    } catch {}
  }
};

