import type { Elysia } from "elysia";
import {
  listProjectsForOwner,
  getProjectForOwner,
  ensureProject,
  updateProjectForOwner,
  deleteProjectForOwner,
  getProjectHistory,
  listProjectFiles,
} from "../db/repo";
import { hasDb } from "../db/client";
import { getUserFromRequest } from "../services/authGuard";

const unauthorized = (set: { status?: number | string }) => {
  set.status = 401;
  return { error: "unauthorized" };
};

const dbUnavailable = (set: { status?: number | string }) => {
  set.status = 503;
  return { error: "database not configured" };
};

export const projectController = (app: Elysia) =>
  app
    .get("/projects", async ({ request, query, set }) => {
      if (!hasDb) return dbUnavailable(set);
      const user = await getUserFromRequest(request);
      if (!user) return unauthorized(set);
      const q = typeof query.q === "string" ? query.q : undefined;
      const page = query.page ? Number(query.page) : undefined;
      const pageSize = query.pageSize ? Number(query.pageSize) : undefined;
      return { data: await listProjectsForOwner(user.id, { q, page, pageSize }) };
    })
    .get("/projects/:id", async ({ params, request, set }) => {
      if (!hasDb) return dbUnavailable(set);
      const user = await getUserFromRequest(request);
      if (!user) return unauthorized(set);
      const project = await getProjectForOwner(params.id, user.id);
      if (!project) {
        set.status = 404;
        return { error: "not found" };
      }
      return { data: project };
    })
    .post("/projects", async ({ body, request, set }) => {
      if (!hasDb) return dbUnavailable(set);
      const user = await getUserFromRequest(request);
      if (!user) return unauthorized(set);
      const b = (body as Record<string, unknown>) ?? {};
      const name = ((b.name as string) ?? (b.id as string) ?? crypto.randomUUID()).trim();
      if (!name) {
        set.status = 400;
        return { error: "name required" };
      }
      const description = typeof b.description === "string" ? b.description : undefined;
      const project = await ensureProject(name, user.id, { description });
      if (project?.forbidden) {
        set.status = 409;
        return { error: "project name already taken" };
      }
      return { data: project };
    })
    .put("/projects/:id", async ({ params, body, request, set }) => {
      if (!hasDb) return dbUnavailable(set);
      const user = await getUserFromRequest(request);
      if (!user) return unauthorized(set);
      const patch = body as Partial<{ name: string; description: string | null; isArchived: boolean }>;
      const updated = await updateProjectForOwner(params.id, user.id, patch);
      if (!updated) {
        set.status = 404;
        return { error: "not found" };
      }
      return { data: updated };
    })
    .get("/projects/:id/history", async ({ params, request, set }) => {
      if (!hasDb) return dbUnavailable(set);
      const user = await getUserFromRequest(request);
      if (!user) return unauthorized(set);
      const project = await getProjectForOwner(params.id, user.id);
      if (!project) {
        set.status = 404;
        return { error: "not found" };
      }
      return { data: await getProjectHistory(project.id) };
    })
    .get("/projects/:id/files", async ({ params, request, set }) => {
      if (!hasDb) return dbUnavailable(set);
      const user = await getUserFromRequest(request);
      if (!user) return unauthorized(set);
      const project = await getProjectForOwner(params.id, user.id);
      if (!project) {
        set.status = 404;
        return { error: "not found" };
      }
      const rows = await listProjectFiles(project.id);
      const files: Record<string, string> = {};
      for (const f of rows) {
        if (f.isDirectory) continue;
        files[f.path] = f.content;
      }
      return { data: files };
    })
    .delete("/projects/:id", async ({ params, request, set }) => {
      if (!hasDb) return dbUnavailable(set);
      const user = await getUserFromRequest(request);
      if (!user) return unauthorized(set);
      const deleted = await deleteProjectForOwner(params.id, user.id);
      if (!deleted) {
        set.status = 404;
        return { error: "not found" };
      }
      return { data: { id: params.id, deleted: true } };
    });
