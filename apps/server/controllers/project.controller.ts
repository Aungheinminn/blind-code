import type { Elysia } from "elysia";
import { randomInt } from "crypto";
import { rm } from "fs/promises";
import { join } from "path";
import { isUuid, stringToUuid } from "../services/uuid";
import {
  listProjectsForOwner,
  getProjectForOwner,
  ensureProject,
  updateProjectForOwner,
  deleteProjectForOwner,
  getProjectHistory,
  getLatestPlanForProject,
  listProjectFiles,
  setSupabaseIntegrationForOwner,
  clearSupabaseIntegrationForOwner,
  findProjectByOwnerAndSupabaseRef,
  listAttachedSupabaseRefsForOwner,
  resolveProjectId,
  getUserById,
  getActiveDesignTemplateForProject,
  setDesignTemplateForProject,
} from "../db/repo";
import { templateToCss } from "../services/designTemplate";
import type { DesignTemplateFrontmatter } from "@vibe/shared";
import { hasDb } from "../db/client";
import { getUserFromRequest } from "../services/authGuard";
import { generateProjectTitle } from "../services/titler";
import { providerForModel } from "@vibe/shared";
import {
  getSupabaseApiKeys,
  SupabaseManagementError,
} from "../services/supabaseManagement";
import {
  toPublicIntegrations,
  type AgentToolPermissions,
  type ProjectIntegrations,
  type SupabaseIntegration,
} from "@vibe/shared";

const ALLOWED_AGENT_TOOLS = new Set([
  "create_supabase_project",
  "attach_supabase_project",
]);

const parseAgentToolPermissions = (
  value: unknown,
): AgentToolPermissions | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) return undefined;
  const out: AgentToolPermissions = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (!ALLOWED_AGENT_TOOLS.has(k)) continue;
    if (typeof v !== "boolean") continue;
    (out as Record<string, boolean>)[k] = v;
  }
  return out;
};

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

const extractSupabaseRef = (url: string): string | null => {
  try {
    const host = new URL(url).host.toLowerCase();
    const m = host.match(/^([a-z0-9-]+)\.supabase\.co$/);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
};

const parseSupabaseBody = (body: unknown): SupabaseIntegration | string => {
  const b = (body as Record<string, unknown>) ?? {};
  const url = typeof b.url === "string" ? b.url.trim() : "";
  const anonKey = typeof b.anonKey === "string" ? b.anonKey.trim() : "";
  const serviceRoleKey =
    typeof b.serviceRoleKey === "string" ? b.serviceRoleKey.trim() : "";
  const databaseUrl =
    typeof b.databaseUrl === "string" ? b.databaseUrl.trim() : "";
  if (!url) return "url required";
  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) return "url must be http(s)";
  } catch {
    return "url must be a valid URL";
  }
  if (!anonKey) return "anonKey required";
  if (databaseUrl) {
    try {
      const parsed = new URL(databaseUrl);
      if (!/^postgres(ql)?:$/.test(parsed.protocol)) {
        return "databaseUrl must start with postgres:// or postgresql://";
      }
    } catch {
      return "databaseUrl must be a valid URL";
    }
  }
  return {
    url,
    anonKey,
    serviceRoleKey: serviceRoleKey || undefined,
    databaseUrl: databaseUrl || undefined,
    connectedAt: new Date().toISOString(),
  };
};

export const projectController = (app: Elysia) =>
  app
    .get("/projects/integrations/supabase/attached-refs", async ({ request, set }) => {
      if (!hasDb) return dbUnavailable(set);
      const user = await getUserFromRequest(request);
      if (!user) return unauthorized(set);
      return { data: await listAttachedSupabaseRefsForOwner(user.id) };
    })
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
      const model = typeof b.model === "string" ? b.model.trim() : "";
      const presetName = typeof b.name === "string" ? b.name.trim() : "";
      const presetDescription =
        typeof b.description === "string" ? b.description.trim() : "";
      if (!prompt) {
        set.status = 400;
        return { error: "prompt required" };
      }
      if (!model) {
        set.status = 400;
        return { error: "model required" };
      }
      const provider = providerForModel(model);
      if (!provider) {
        set.status = 400;
        return { error: `unknown model: ${model}` };
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
      const raw = (body as Record<string, unknown>) ?? {};
      const patch: Partial<{
        name: string;
        description: string | null;
        isArchived: boolean;
        agentToolPermissions: AgentToolPermissions | null;
      }> = {};
      if (typeof raw.name === "string") patch.name = raw.name;
      if (raw.description === null || typeof raw.description === "string") {
        patch.description = raw.description as string | null;
      }
      if (typeof raw.isArchived === "boolean") patch.isArchived = raw.isArchived;
      const perms = parseAgentToolPermissions(raw.agentToolPermissions);
      if (perms !== undefined) patch.agentToolPermissions = perms;
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
      const ref = extractSupabaseRef(parsed.url);
      if (ref) {
        const conflict = await findProjectByOwnerAndSupabaseRef(
          user.id,
          ref,
          resolveProjectId(params.id, user.id),
        );
        if (conflict) {
          set.status = 409;
          return {
            error: `This Supabase project is already attached to “${conflict.name}”. Detach it there first.`,
          };
        }
      }
      const updated = await setSupabaseIntegrationForOwner(params.id, user.id, parsed);
      if (!updated) {
        set.status = 404;
        return { error: "not found" };
      }
      return { data: toPublicProject(updated) };
    })
    .post(
      "/projects/:id/integrations/supabase/attach",
      async ({ params, body, request, set }) => {
        if (!hasDb) return dbUnavailable(set);
        const user = await getUserFromRequest(request);
        if (!user) return unauthorized(set);
        const b = (body as Record<string, unknown>) ?? {};
        const projectRef =
          typeof b.projectRef === "string" ? b.projectRef.trim() : "";
        if (!projectRef) {
          set.status = 400;
          return { error: "projectRef required" };
        }
        const conflict = await findProjectByOwnerAndSupabaseRef(
          user.id,
          projectRef,
          resolveProjectId(params.id, user.id),
        );
        if (conflict) {
          set.status = 409;
          return {
            error: `This Supabase project is already attached to “${conflict.name}”. Detach it there first.`,
          };
        }
        const userRow = await getUserById(user.id);
        const pat = userRow?.integrations?.supabase?.accessToken;
        if (!pat) {
          set.status = 400;
          return {
            error:
              "Supabase account not connected. Add a Personal Access Token on the Supabase page first.",
          };
        }
        let apiKeys;
        try {
          apiKeys = await getSupabaseApiKeys(pat, projectRef);
        } catch (err) {
          if (err instanceof SupabaseManagementError) {
            set.status = err.status === 401 ? 401 : 502;
            return { error: err.message };
          }
          set.status = 502;
          return { error: err instanceof Error ? err.message : String(err) };
        }
        const anon = apiKeys.find((k) => k.name === "anon")?.api_key;
        const serviceRole = apiKeys.find((k) => k.name === "service_role")?.api_key;
        if (!anon) {
          set.status = 502;
          return { error: "Supabase did not return an anon key for this project" };
        }
        const integration: SupabaseIntegration = {
          url: `https://${projectRef}.supabase.co`,
          anonKey: anon,
          serviceRoleKey: serviceRole || undefined,
          projectRef,
          connectedAt: new Date().toISOString(),
        };
        const updated = await setSupabaseIntegrationForOwner(
          params.id,
          user.id,
          integration,
        );
        if (!updated) {
          set.status = 404;
          return { error: "not found" };
        }
        return { data: toPublicProject(updated) };
      },
    )
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
      const [messages, latestPlan] = await Promise.all([
        getProjectHistory(project.id),
        getLatestPlanForProject(project.id),
      ]);
      return { data: { messages, latestPlan } };
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
    .get("/projects/:id/design-template", async ({ params, request, set }) => {
      if (!hasDb) return dbUnavailable(set);
      const user = await getUserFromRequest(request);
      if (!user) return unauthorized(set);
      const tpl = await getActiveDesignTemplateForProject(params.id, user.id);
      if (!tpl) {
        set.status = 404;
        return { error: "project or design template not found" };
      }
      const tokens = (tpl.parsedTokens ?? {}) as DesignTemplateFrontmatter;
      const css = templateToCss(tokens);
      return {
        data: {
          id: tpl.id,
          slug: tpl.slug,
          name: tpl.name,
          description: tpl.description,
          origin: tpl.origin,
          css,
          tokens,
        },
      };
    })
    .put("/projects/:id/design-template", async ({ params, body, request, set }) => {
      if (!hasDb) return dbUnavailable(set);
      const user = await getUserFromRequest(request);
      if (!user) return unauthorized(set);
      const raw = (body as Record<string, unknown>) ?? {};
      const rawId = raw.designTemplateId;
      const designTemplateId =
        rawId === null || rawId === "" ? null : typeof rawId === "string" ? rawId : undefined;
      if (designTemplateId === undefined) {
        set.status = 400;
        return { error: "designTemplateId must be a uuid string or null" };
      }
      const ok = await setDesignTemplateForProject(params.id, user.id, designTemplateId);
      if (!ok) {
        set.status = 404;
        return { error: "not found" };
      }
      return { data: { id: params.id, designTemplateId } };
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
      // Sandbox lives on disk keyed by the same id — the next create-with-same-name
      // resolves to the same UUID, so leftover files would leak into the fresh project.
      // Clean both the as-passed key and the canonical UUID in case the URL used a name.
      const canonicalId = isUuid(params.id)
        ? params.id.toLowerCase()
        : stringToUuid(`${user.id}:${params.id}`);
      for (const key of new Set([params.id, canonicalId])) {
        try {
          await rm(join("/tmp/vibe-sandbox", key), { recursive: true, force: true });
        } catch {}
      }
      return { data: { id: params.id, deleted: true } };
    });
