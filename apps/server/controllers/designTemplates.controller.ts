import type { Elysia } from "elysia";
import { asc, eq } from "drizzle-orm";
import { db, hasDb, schema } from "../db/client";
import { getUserFromRequest } from "../services/authGuard";
import {
  listDesignTemplatesForUser,
  softDeleteDesignTemplateForOwner,
  restoreDesignTemplateForOwner,
  setArchivedForDesignTemplate,
  hardDeleteDesignTemplateForOwner,
  createAgentDesignTemplate,
  getDesignTemplateForReader,
  updateDesignTemplateForOwner,
  type DesignTemplateListFilter,
} from "../db/repo";
import { parseTemplate } from "../services/designTemplate";
import { friendlyError } from "../services/errors";

const NAME_MAX = 160;

const checkNameLength = (
  name: string,
): { error: string } | null =>
  name.length > NAME_MAX
    ? { error: `Title is too long — keep it under ${NAME_MAX} characters.` }
    : null;

export const designTemplatesController = (app: Elysia) =>
  app
    .get("/design-templates", async ({ request, query, set }) => {
      if (!hasDb || !db) {
        set.status = 503;
        return { error: "database not configured" };
      }
      const rawFilter = typeof query.filter === "string" ? query.filter : "active";
      const filter: DesignTemplateListFilter =
        rawFilter === "archived" || rawFilter === "deleted" ? rawFilter : "active";
      const user = await getUserFromRequest(request);
      if (user) {
        return { data: await listDesignTemplatesForUser(user.id, { filter }) };
      }
      if (filter !== "active") return { data: [] };
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
    .get("/design-templates/:id", async ({ params, request, set }) => {
      if (!hasDb) {
        set.status = 503;
        return { error: "database not configured" };
      }
      const user = await getUserFromRequest(request);
      if (!user) {
        set.status = 401;
        return { error: "unauthorized" };
      }
      const result = await getDesignTemplateForReader(params.id, user.id);
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
      return { data: result.row };
    })
    .put("/design-templates/:id", async ({ params, body, request, set }) => {
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
      const nameErr = checkNameLength(name);
      if (nameErr) {
        set.status = 400;
        return nameErr;
      }
      const rawDesc = typeof b.description === "string" ? b.description : "";
      const description =
        rawDesc.trim().length > 0
          ? rawDesc.trim()
          : (parsed.tokens.description ?? null);
      try {
        const result = await updateDesignTemplateForOwner(params.id, user.id, {
          name,
          description,
          content: markdown,
          parsedTokens: parsed.tokens,
        });
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
        return { data: result.updated };
      } catch (err) {
        set.status = 500;
        return { error: friendlyError(err, { entity: "template", field: "title" }) };
      }
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
      const nameErr = checkNameLength(name);
      if (nameErr) {
        set.status = 400;
        return nameErr;
      }
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
        return { error: friendlyError(err, { entity: "template", field: "title" }) };
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
      const result = await softDeleteDesignTemplateForOwner(params.id, user.id);
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
    })
    .post("/design-templates/:id/restore", async ({ params, request, set }) => {
      if (!hasDb) {
        set.status = 503;
        return { error: "database not configured" };
      }
      const user = await getUserFromRequest(request);
      if (!user) {
        set.status = 401;
        return { error: "unauthorized" };
      }
      const result = await restoreDesignTemplateForOwner(params.id, user.id);
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
      return { data: { id: params.id, restored: true } };
    })
    .delete("/design-templates/:id/permanent", async ({ params, request, set }) => {
      if (!hasDb) {
        set.status = 503;
        return { error: "database not configured" };
      }
      const user = await getUserFromRequest(request);
      if (!user) {
        set.status = 401;
        return { error: "unauthorized" };
      }
      const result = await hardDeleteDesignTemplateForOwner(params.id, user.id);
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
    })
    .patch("/design-templates/:id/archive", async ({ params, body, request, set }) => {
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
      const isArchived =
        typeof b.isArchived === "boolean" ? b.isArchived : true;
      const result = await setArchivedForDesignTemplate(params.id, user.id, isArchived);
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
      return { data: { id: params.id, isArchived } };
    });
