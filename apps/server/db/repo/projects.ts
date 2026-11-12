import { and, desc, eq, ilike, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { db, schema } from "../client";
import type {
  AgentToolPermissions,
  ProjectIntegrations,
  SupabaseIntegration,
} from "@vibe/shared";
import {
  encryptProjectIntegrations,
  decryptProjectRow,
  projectIdFor,
} from "./rows";

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

export const createProject = async (
  name: string,
  ownerId: string,
  opts: { description?: string | null } = {},
): Promise<{ id: string; created: boolean }> => {
  if (!db) throw new Error("db unavailable");
  const description =
    typeof opts.description === "string" && opts.description.trim().length > 0
      ? opts.description
      : null;
  const [created] = await db
    .insert(schema.projects)
    .values({ id: crypto.randomUUID(), ownerId, name, description })
    .returning();
  return { id: created.id, created: true };
};

export type ProjectListFilter = "active" | "archived" | "deleted";

export const listProjectsForOwner = async (
  ownerId: string,
  opts: {
    q?: string;
    page?: number;
    pageSize?: number;
    filter?: ProjectListFilter;
  } = {},
) => {
  if (!db) return { items: [], total: 0, page: 1, pageSize: opts.pageSize ?? 12 };
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(opts.pageSize ?? 12)));
  const q = (opts.q ?? "").trim();
  const filter: ProjectListFilter = opts.filter ?? "active";

  const ownerFilter = eq(schema.projects.ownerId, ownerId);
  const stateFilter =
    filter === "deleted"
      ? isNotNull(schema.projects.deletedAt)
      : filter === "archived"
        ? and(isNull(schema.projects.deletedAt), eq(schema.projects.isArchived, true))
        : and(isNull(schema.projects.deletedAt), eq(schema.projects.isArchived, false));
  const searchFilter = q
    ? or(
        ilike(schema.projects.name, `%${q}%`),
        ilike(schema.projects.description, `%${q}%`),
      )
    : undefined;
  const where = searchFilter
    ? and(ownerFilter, stateFilter, searchFilter)
    : and(ownerFilter, stateFilter);

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

export const getProjectForOwner = async (
  idOrName: string,
  ownerId: string,
  opts: { includeDeleted?: boolean } = {},
) => {
  if (!db) return null;
  const id = projectIdFor(idOrName, ownerId);
  const base = and(
    eq(schema.projects.id, id),
    eq(schema.projects.ownerId, ownerId),
  );
  const where = opts.includeDeleted
    ? base
    : and(base, isNull(schema.projects.deletedAt));
  const rows = await db.select().from(schema.projects).where(where).limit(1);
  return decryptProjectRow(rows[0] ?? null);
};

export const updateProjectForOwner = async (
  idOrName: string,
  ownerId: string,
  patch: Partial<{
    name: string;
    description: string | null;
    isArchived: boolean;
    agentToolPermissions: AgentToolPermissions | null;
  }>,
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

export const setVercelIntegrationForOwner = async (
  idOrName: string,
  ownerId: string,
  integration: NonNullable<ProjectIntegrations["vercel"]>,
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
    vercel: integration,
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

export const setGitHubIntegrationForOwner = async (
  idOrName: string,
  ownerId: string,
  integration: NonNullable<ProjectIntegrations["github"]>,
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
    github: integration,
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

export const clearGitHubIntegrationForOwner = async (
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
  const { github: _drop, ...rest } = current;
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

export const clearVercelIntegrationForOwner = async (
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
  const { vercel: _drop, ...rest } = current;
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

export const softDeleteProjectForOwner = async (
  idOrName: string,
  ownerId: string,
) => {
  if (!db) return false;
  const id = projectIdFor(idOrName, ownerId);
  const now = new Date();
  const [row] = await db
    .update(schema.projects)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(
        eq(schema.projects.id, id),
        eq(schema.projects.ownerId, ownerId),
        isNull(schema.projects.deletedAt),
      ),
    )
    .returning({ id: schema.projects.id });
  return Boolean(row);
};

export const restoreProjectForOwner = async (
  idOrName: string,
  ownerId: string,
) => {
  if (!db) return null;
  const id = projectIdFor(idOrName, ownerId);
  const [updated] = await db
    .update(schema.projects)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(
      and(
        eq(schema.projects.id, id),
        eq(schema.projects.ownerId, ownerId),
        isNotNull(schema.projects.deletedAt),
      ),
    )
    .returning();
  return decryptProjectRow(updated ?? null);
};

export const hardDeleteProjectForOwner = async (idOrName: string, ownerId: string) => {
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

    const planRows = await tx
      .select({ id: schema.plans.id })
      .from(schema.plans)
      .where(eq(schema.plans.projectId, id));
    const planIds = planRows.map((r) => r.id);

    if (planIds.length > 0) {
      await tx.delete(schema.planTodos).where(inArray(schema.planTodos.planId, planIds));
      await tx.delete(schema.plans).where(inArray(schema.plans.id, planIds));
    }
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
    await tx.delete(schema.projectCheckpoints).where(eq(schema.projectCheckpoints.projectId, id));
    await tx
      .delete(schema.projects)
      .where(and(eq(schema.projects.id, id), eq(schema.projects.ownerId, ownerId)));
    return true;
  });
};


export const updateProjectContextSummary = async (
  projectId: string,
  summary: string,
  covers: number,
) => {
  if (!db) return;
  await db
    .update(schema.projects)
    .set({ contextSummary: summary, contextSummaryCovers: covers })
    .where(eq(schema.projects.id, projectId));
};

export const setProjectShareToken = async (
  projectId: string,
  ownerId: string,
  token: string | null,
) => {
  if (!db) return null;
  const [row] = await db
    .update(schema.projects)
    .set({ shareToken: token })
    .where(
      and(
        eq(schema.projects.id, projectId),
        eq(schema.projects.ownerId, ownerId),
        isNull(schema.projects.deletedAt),
      ),
    )
    .returning({ shareToken: schema.projects.shareToken });
  return row ?? null;
};

export const getProjectByShareToken = async (token: string) => {
  if (!db) return null;
  const rows = await db
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.shareToken, token), isNull(schema.projects.deletedAt)))
    .limit(1);
  return decryptProjectRow(rows[0] ?? null);
};
