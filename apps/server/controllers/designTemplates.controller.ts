import type { Elysia } from "elysia";
import { and, asc, eq } from "drizzle-orm";
import { db, hasDb, schema } from "../db/client";

export const designTemplatesController = (app: Elysia) =>
  app.get("/design-templates", async ({ set }) => {
    if (!hasDb || !db) {
      set.status = 503;
      return { error: "database not configured" };
    }
    const rows = await db
      .select({
        id: schema.designTemplates.id,
        slug: schema.designTemplates.slug,
        name: schema.designTemplates.name,
        description: schema.designTemplates.description,
        origin: schema.designTemplates.origin,
        parsedTokens: schema.designTemplates.parsedTokens,
        isReadOnly: schema.designTemplates.isReadOnly,
        sortOrder: schema.designTemplates.sortOrder,
        updatedAt: schema.designTemplates.updatedAt,
      })
      .from(schema.designTemplates)
      .where(eq(schema.designTemplates.origin, "builtin"))
      .orderBy(
        asc(schema.designTemplates.sortOrder),
        asc(schema.designTemplates.createdAt),
      );
    return { data: rows };
  });
