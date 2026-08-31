import type { Elysia } from "elysia";
import {
  listProjects,
  getProject,
  ensureProject,
  updateProject,
  deleteProject,
  hasDb,
} from "../db/repo";

export const projectController = (app: Elysia) =>
  app
    .get("/projects", async () => {
      if (!hasDb) return { data: [], warning: "DATABASE_URL not set" };
      return { data: await listProjects() };
    })
    .get("/projects/:id", async ({ params }) => {
      if (!hasDb) return { data: { id: params.id }, warning: "DATABASE_URL not set" };
      const project = await getProject(params.id);
      return { data: project };
    })
    .post("/projects", async ({ body }) => {
      const b = (body as Record<string, unknown>) ?? {};
      const name = (b.name as string) ?? (b.id as string) ?? crypto.randomUUID();
      if (!hasDb) return { data: { id: name, name }, warning: "DATABASE_URL not set" };
      const project = await ensureProject(name);
      return { data: project };
    })
    .put("/projects/:id", async ({ params, body }) => {
      if (!hasDb) return { data: { id: params.id, ...(body as Record<string, unknown>) }, warning: "DATABASE_URL not set" };
      const patch = body as Partial<{ name: string; description: string | null; isArchived: boolean }>;
      const updated = await updateProject(params.id, patch);
      return { data: updated };
    })
    .delete("/projects/:id", async ({ params }) => {
      if (!hasDb) return { data: { id: params.id, deleted: true }, warning: "DATABASE_URL not set" };
      const deleted = await deleteProject(params.id);
      return { data: { id: params.id, deleted } };
    });
