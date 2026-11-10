import { and, asc, desc, eq, ilike, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { db, schema } from "../client";
import { getProjectForOwner } from "./projects";

export const getActiveDesignTemplateForProject = async (
  projectId: string,
  ownerId: string,
) => {
  if (!db) return null;
  const project = await getProjectForOwner(projectId, ownerId);
  if (!project) return null;

  if (!project.designTemplateId) return null;

  const rows = await db
    .select()
    .from(schema.designTemplates)
    .where(
      and(
        eq(schema.designTemplates.id, project.designTemplateId),
        isNull(schema.designTemplates.deletedAt),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
};

export const setDesignTemplateForProject = async (
  projectId: string,
  ownerId: string,
  designTemplateId: string | null,
) => {
  if (!db) return null;
  const project = await getProjectForOwner(projectId, ownerId);
  if (!project) return null;
  await db
    .update(schema.projects)
    .set({ designTemplateId, updatedAt: sql`now()` })
    .where(
      and(eq(schema.projects.id, project.id), eq(schema.projects.ownerId, ownerId)),
    );
  return true;
};

const USER_TEMPLATE_SORT_ORDER = 1000;

const slugifyTemplateName = (raw: string): string => {
  const base = raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "template";
};

const findAvailableTemplateSlug = async (base: string): Promise<string> => {
  if (!db) return base;
  const rows = await db
    .select({ slug: schema.designTemplates.slug })
    .from(schema.designTemplates)
    .where(ilike(schema.designTemplates.slug, `${base}%`));
  const taken = new Set(rows.map((r) => r.slug).filter((s): s is string => !!s));
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
};

export const createAgentDesignTemplate = async (input: {
  ownerUserId: string;
  name: string;
  description?: string | null;
  content: string;
  parsedTokens: unknown;
  sourceProjectId?: string | null;
}) => {
  if (!db) return null;
  const baseSlug = slugifyTemplateName(input.name);
  const slug = await findAvailableTemplateSlug(baseSlug);
  const [row] = await db
    .insert(schema.designTemplates)
    .values({
      slug,
      name: input.name,
      description: input.description ?? null,
      content: input.content,
      parsedTokens: input.parsedTokens as any,
      origin: "agent",
      ownerUserId: input.ownerUserId,
      sourceProjectId: input.sourceProjectId ?? null,
      isReadOnly: false,
      sortOrder: USER_TEMPLATE_SORT_ORDER,
    })
    .returning();
  return row;
};

export type DesignTemplateListFilter = "active" | "archived" | "deleted";

const designTemplateSelect = {
  id: schema.designTemplates.id,
  slug: schema.designTemplates.slug,
  name: schema.designTemplates.name,
  description: schema.designTemplates.description,
  origin: schema.designTemplates.origin,
  parsedTokens: schema.designTemplates.parsedTokens,
  isReadOnly: schema.designTemplates.isReadOnly,
  isArchived: schema.designTemplates.isArchived,
  deletedAt: schema.designTemplates.deletedAt,
  sortOrder: schema.designTemplates.sortOrder,
  ownerUserId: schema.designTemplates.ownerUserId,
  sourceProjectId: schema.designTemplates.sourceProjectId,
  createdAt: schema.designTemplates.createdAt,
  updatedAt: schema.designTemplates.updatedAt,
} as const;

export const listDesignTemplatesForUser = async (
  ownerUserId: string,
  opts: { filter?: DesignTemplateListFilter } = {},
) => {
  if (!db) return [];
  const filter: DesignTemplateListFilter = opts.filter ?? "active";
  if (filter === "deleted") {
    return db
      .select(designTemplateSelect)
      .from(schema.designTemplates)
      .where(
        and(
          eq(schema.designTemplates.ownerUserId, ownerUserId),
          inArray(schema.designTemplates.origin, ["user", "agent"]),
          isNotNull(schema.designTemplates.deletedAt),
        ),
      )
      .orderBy(desc(schema.designTemplates.updatedAt));
  }
  if (filter === "archived") {
    return db
      .select(designTemplateSelect)
      .from(schema.designTemplates)
      .where(
        and(
          eq(schema.designTemplates.ownerUserId, ownerUserId),
          inArray(schema.designTemplates.origin, ["user", "agent"]),
          isNull(schema.designTemplates.deletedAt),
          eq(schema.designTemplates.isArchived, true),
        ),
      )
      .orderBy(desc(schema.designTemplates.updatedAt));
  }
  return db
    .select(designTemplateSelect)
    .from(schema.designTemplates)
    .where(
      or(
        eq(schema.designTemplates.origin, "builtin"),
        and(
          eq(schema.designTemplates.ownerUserId, ownerUserId),
          inArray(schema.designTemplates.origin, ["user", "agent"]),
          isNull(schema.designTemplates.deletedAt),
          eq(schema.designTemplates.isArchived, false),
        ),
      ),
    )
    .orderBy(
      asc(schema.designTemplates.sortOrder),
      desc(schema.designTemplates.updatedAt),
    );
};

type DesignTemplateMutResult =
  | { ok: true }
  | { forbidden: true }
  | { notFound: true }
  | null;

const checkOwnedUserTemplate = async (
  id: string,
  ownerUserId: string,
  opts: { includeDeleted?: boolean } = {},
): Promise<
  | { row: typeof schema.designTemplates.$inferSelect }
  | { notFound: true }
  | { forbidden: true }
> => {
  const rows = await db!
    .select()
    .from(schema.designTemplates)
    .where(eq(schema.designTemplates.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return { notFound: true };
  if (row.origin === "builtin" || row.isReadOnly) return { forbidden: true };
  if (row.ownerUserId !== ownerUserId) return { forbidden: true };
  if (!opts.includeDeleted && row.deletedAt) return { notFound: true };
  return { row };
};

export const softDeleteDesignTemplateForOwner = async (
  id: string,
  ownerUserId: string,
): Promise<DesignTemplateMutResult> => {
  if (!db) return null;
  const check = await checkOwnedUserTemplate(id, ownerUserId);
  if ("notFound" in check) return { notFound: true };
  if ("forbidden" in check) return { forbidden: true };
  await db
    .update(schema.designTemplates)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.designTemplates.id, id));
  return { ok: true };
};

export const restoreDesignTemplateForOwner = async (
  id: string,
  ownerUserId: string,
): Promise<DesignTemplateMutResult> => {
  if (!db) return null;
  const check = await checkOwnedUserTemplate(id, ownerUserId, {
    includeDeleted: true,
  });
  if ("notFound" in check) return { notFound: true };
  if ("forbidden" in check) return { forbidden: true };
  await db
    .update(schema.designTemplates)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(eq(schema.designTemplates.id, id));
  return { ok: true };
};

export const setArchivedForDesignTemplate = async (
  id: string,
  ownerUserId: string,
  isArchived: boolean,
): Promise<DesignTemplateMutResult> => {
  if (!db) return null;
  const check = await checkOwnedUserTemplate(id, ownerUserId);
  if ("notFound" in check) return { notFound: true };
  if ("forbidden" in check) return { forbidden: true };
  await db
    .update(schema.designTemplates)
    .set({ isArchived, updatedAt: new Date() })
    .where(eq(schema.designTemplates.id, id));
  return { ok: true };
};

export const hardDeleteDesignTemplateForOwner = async (
  id: string,
  ownerUserId: string,
): Promise<
  { deleted: true } | { forbidden: true } | { notFound: true } | null
> => {
  if (!db) return null;
  const check = await checkOwnedUserTemplate(id, ownerUserId, {
    includeDeleted: true,
  });
  if ("notFound" in check) return { notFound: true };
  if ("forbidden" in check) return { forbidden: true };
  await db
    .delete(schema.designTemplates)
    .where(eq(schema.designTemplates.id, id));
  return { deleted: true };
};

export const getDesignTemplateForReader = async (
  id: string,
  ownerUserId: string,
) => {
  if (!db) return null;
  const rows = await db
    .select()
    .from(schema.designTemplates)
    .where(eq(schema.designTemplates.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return { notFound: true as const };
  if (row.origin === "builtin") return { row };
  if (row.ownerUserId !== ownerUserId) return { forbidden: true as const };
  if (row.deletedAt) return { notFound: true as const };
  return { row };
};

export const updateDesignTemplateForOwner = async (
  id: string,
  ownerUserId: string,
  patch: {
    name: string;
    description: string | null;
    content: string;
    parsedTokens: unknown;
  },
): Promise<
  { updated: NonNullable<Awaited<ReturnType<typeof getDesignTemplateForReader>>>["row"] }
  | { forbidden: true }
  | { notFound: true }
  | null
> => {
  if (!db) return null;
  const rows = await db
    .select()
    .from(schema.designTemplates)
    .where(eq(schema.designTemplates.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return { notFound: true };
  if (row.origin === "builtin" || row.isReadOnly) return { forbidden: true };
  if (row.ownerUserId !== ownerUserId) return { forbidden: true };
  if (row.deletedAt) return { notFound: true };
  const [updated] = await db
    .update(schema.designTemplates)
    .set({
      name: patch.name,
      description: patch.description,
      content: patch.content,
      parsedTokens: patch.parsedTokens as any,
      updatedAt: sql`now()`,
    })
    .where(eq(schema.designTemplates.id, id))
    .returning();
  return { updated };
};
