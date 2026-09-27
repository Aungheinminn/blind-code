import type { Elysia } from "elysia";
import { asc, eq } from "drizzle-orm";
import { db, hasDb, schema } from "../db/client";
import { getUserFromRequest } from "../services/authGuard";
import {
  listDesignTemplatesForUser,
  deleteDesignTemplateForOwner,
  createAgentDesignTemplate,
} from "../db/repo";
import { parseTemplate } from "../services/designTemplate";

export const designTemplatesController = (app: Elysia) =>
  app
    .get("/design-templates", async ({ request, set }) => {
      if (!hasDb || !db) {
        set.status = 503;
        return { error: "database not configured" };
      }
      const user = await getUserFromRequest(request);
      if (user) {
        return { data: await listDesignTemplatesForUser(user.id) };
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
    })
    .post("/design-templates", async ({ body, request, set }) => {
      if (!hasDb) {
        set.status = 503;
        return { error: "database not configured" };
      }
      const user = await getUserFromRequest(request);
      if (!user) {
        set.status = 401;
        return { error: "unauthorized" };
      }
      const b = (body as Record<string, unknown>) ?? {};
      const markdown = typeof b.markdown === "string" ? b.markdown : "";
      if (!markdown.trim()) {
        set.status = 400;
        return { error: "markdown required" };
      }
      let parsed;
      try {
        parsed = parseTemplate(markdown);
      } catch (err) {
        set.status = 400;
        return {
          error:
            err instanceof Error
              ? `draft failed validation: ${err.message}`
              : "draft failed validation",
        };
      }
      const rawName = typeof b.name === "string" ? b.name.trim() : "";
      const name = rawName.length > 0 ? rawName : parsed.tokens.name;
      const rawDesc = typeof b.description === "string" ? b.description : "";
      const description =
        rawDesc.trim().length > 0
          ? rawDesc.trim()
          : (parsed.tokens.description ?? null);
      try {
        const row = await createAgentDesignTemplate({
          ownerUserId: user.id,
          name,
          description,
          content: markdown,
          parsedTokens: parsed.tokens,
        });
        if (!row) {
          set.status = 503;
          return { error: "database not configured" };
        }
        return { data: { id: row.id, slug: row.slug, name: row.name } };
      } catch (err) {
        set.status = 500;
        return {
          error: err instanceof Error ? err.message : "failed to save template",
        };
      }
    })
    .delete("/design-templates/:id", async ({ params, request, set }) => {
      if (!hasDb) {
        set.status = 503;
        return { error: "database not configured" };
      }
      const user = await getUserFromRequest(request);
      if (!user) {
        set.status = 401;
        return { error: "unauthorized" };
      }
      const result = await deleteDesignTemplateForOwner(params.id, user.id);
      if (!result) {
        set.status = 503;
        return { error: "database not configured" };
      }
      if ("notFound" in result) {
        set.status = 404;
        return { error: "not found" };
      }
      if ("forbidden" in result) {
        set.status = 403;
        return { error: "forbidden" };
      }
      return { data: { id: params.id, deleted: true } };
    });
