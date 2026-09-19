import type { Elysia } from "elysia";
import { randomInt } from "crypto";
import {
  listProjectsForOwner,
  getProjectForOwner,
  ensureProject,
  updateProjectForOwner,
  deleteProjectForOwner,
  getProjectHistory,
  listProjectFiles,
  setSupabaseIntegrationForOwner,
  clearSupabaseIntegrationForOwner,
} from "../db/repo";
import { hasDb } from "../db/client";
import { getUserFromRequest } from "../services/authGuard";
import { generateProjectTitle } from "../services/titler";
import {
  toPublicIntegrations,
  type ProjectIntegrations,
  type SupabaseIntegration,
} from "@vibe/shared";

const unauthorized = (set: { status?: number | string }) => {
  set.status = 401;
  return { error: "unauthorized" };
};

const dbUnavailable = (set: { status?: number | string }) => {
  set.status = 503;
  return { error: "database not configured" };
};

type ProjectRow = {
  integrations: ProjectIntegrations | null;
  [key: string]: unknown;
};

const toPublicProject = <T extends ProjectRow>(project: T) => ({
  ...project,
  integrations: toPublicIntegrations(project.integrations),
});

const parseSupabaseBody = (body: unknown): SupabaseIntegration | string => {
  const b = (body as Record<string, unknown>) ?? {};
  const url = typeof b.url === "string" ? b.url.trim() : "";
  const anonKey = typeof b.anonKey === "string" ? b.anonKey.trim() : "";
  const serviceRoleKey =
    typeof b.serviceRoleKey === "string" ? b.serviceRoleKey.trim() : "";
  if (!url) return "url required";
  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) return "url must be http(s)";
  } catch {
    return "url must be a valid URL";
  }
  if (!anonKey) return "anonKey required";
  return {
    url,
    anonKey,
    serviceRoleKey: serviceRoleKey || undefined,
    connectedAt: new Date().toISOString(),
  };
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
      const result = await listProjectsForOwner(user.id, { q, page, pageSize });
      return { data: { ...result, items: result.items.map(toPublicProject) } };
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
      return { data: toPublicProject(project) };
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
      if (!project || project.forbidden || !project.created) {
        set.status = 409;
        return { error: "A project with that name already exists." };
      }
      return { data: project };
    })
    .post("/projects/from-prompt", async ({ body, request, set }) => {
      if (!hasDb) return dbUnavailable(set);
      const user = await getUserFromRequest(request);
      if (!user) return unauthorized(set);
      const b = (body as Record<string, unknown>) ?? {};
      const prompt = typeof b.prompt === "string" ? b.prompt.trim() : "";
      const provider = typeof b.provider === "string" ? b.provider : "";
      const model = typeof b.model === "string" ? b.model : undefined;
      const presetName = typeof b.name === "string" ? b.name.trim() : "";
      const presetDescription =
        typeof b.description === "string" ? b.description.trim() : "";
      if (!prompt) {
        set.status = 400;
        return { error: "prompt required" };
      }
      if (!provider) {
        set.status = 400;
        return { error: "provider required" };
      }
      const { title, description } = presetName
        ? { title: presetName, description: presetDescription }
        : await generateProjectTitle({ prompt, provider, model });
      let candidateName = title;
      let project = await ensureProject(candidateName, user.id, { description });
      let attempts = 0;
      while (project && !project.forbidden && !project.created && attempts < 5) {
        candidateName = `${title} ${randomInt(1000, 10000)}`;
        project = await ensureProject(candidateName, user.id, { description });
        attempts++;
      }
      if (!project || project.forbidden || !project.created) {
        set.status = 500;
        return { error: "could not allocate project name" };
      }
      return { data: { ...project, name: candidateName, description, title } };
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
      return { data: toPublicProject(updated) };
    })
    .put("/projects/:id/integrations/supabase", async ({ params, body, request, set }) => {
      if (!hasDb) return dbUnavailable(set);
      const user = await getUserFromRequest(request);
      if (!user) return unauthorized(set);
      const parsed = parseSupabaseBody(body);
      if (typeof parsed === "string") {
        set.status = 400;
        return { error: parsed };
      }
      const updated = await setSupabaseIntegrationForOwner(params.id, user.id, parsed);
      if (!updated) {
        set.status = 404;
        return { error: "not found" };
      }
      return { data: toPublicProject(updated) };
    })
    .delete("/projects/:id/integrations/supabase", async ({ params, request, set }) => {
      if (!hasDb) return dbUnavailable(set);
      const user = await getUserFromRequest(request);
      if (!user) return unauthorized(set);
      const updated = await clearSupabaseIntegrationForOwner(params.id, user.id);
      if (!updated) {
        set.status = 404;
        return { error: "not found" };
      }
      return { data: toPublicProject(updated) };
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
