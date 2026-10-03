import type { Elysia } from "elysia";
import { rm } from "fs/promises";
import { join } from "path";
import {
  listProjectsForOwner,
  getProjectForOwner,
  ensureProject,
  createProject,
  updateProjectForOwner,
  softDeleteProjectForOwner,
  restoreProjectForOwner,
  hardDeleteProjectForOwner,
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
  type ProjectListFilter,
} from "../db/repo";
import { templateToCss } from "../services/designTemplate";
import type { DesignTemplateFrontmatter } from "@vibe/shared";
import { hasDb } from "../db/client";
import { getUserFromRequest } from "../services/authGuard";
import { friendlyError } from "../services/errors";

const PROJECT_NAME_MAX = 160;
const projectNameTooLong = (n: string) =>
  n.length > PROJECT_NAME_MAX
    ? {
        error: `Project name is too long — keep it under ${PROJECT_NAME_MAX} characters.`,
      }
    : null;
import { generateProjectTitle } from "../services/titler";
import { providerForModel } from "@vibe/shared";
import {
  getSupabaseApiKeys,
  SupabaseManagementError,
} from "../services/supabaseManagement";
import {
  createDeployment,
  createProject as createVercelProject,
  getProjectById as getVercelProjectById,
  getProjectByName as getVercelProjectByName,
  VercelManagementError,
  waitForDeploymentReady,
} from "../services/vercelManagement";
import { assembleVercelProject } from "../services/vercelAssembler";
import {
  clearVercelIntegrationForOwner,
  setVercelIntegrationForOwner,
} from "../db/repo";
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

type DeployProgress =
  | {
      status: "deploying";
      projectName: string;
      startedAt: number;
      deploymentId?: string;
    }
  | {
      status: "ready";
      projectName: string;
      startedAt: number;
      finishedAt: number;
      deploymentId: string;
      url: string;
      deploymentUrl: string;
    }
  | {
      status: "error";
      projectName: string;
      startedAt: number;
      finishedAt: number;
      error: string;
    };

const activeDeploys = new Map<string, DeployProgress>();

const slugifyProjectName = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

const randomProjectSuffix = () =>
  (Math.random().toString(36) + Math.random().toString(36))
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 6)
    .padEnd(6, "0");

const runVercelDeploy = async (args: {
  projectDbId: string;
  ownerId: string;
  projectName: string;
  existingVercel: {
    projectId?: string;
    projectName?: string;
    productionUrl?: string;
    lastDeploymentUrl?: string;
    lastDeploymentId?: string;
    lastDeployedAt?: string;
  } | null;
  files: { file: string; data: string; encoding: "utf-8" | "base64" }[];
}) => {
  const { projectDbId, ownerId, projectName, existingVercel, files } = args;
  const startedAt = activeDeploys.get(projectDbId)?.startedAt ?? Date.now();
  try {
    let vercelProject = existingVercel?.projectId
      ? await getVercelProjectById(existingVercel.projectId)
      : null;
    if (!vercelProject) {
      vercelProject = await getVercelProjectByName(projectName);
    }
    if (!vercelProject) {
      vercelProject = await createVercelProject({
        name: projectName,
        framework: "vite",
      });
    }
    const projectId = vercelProject.id;

    if (!existingVercel || existingVercel.projectId !== projectId) {
      await setVercelIntegrationForOwner(projectDbId, ownerId, {
        ...(existingVercel ?? {}),
        projectId,
        projectName,
      });
    }

    const deployment = await createDeployment({
      name: projectName,
      project: projectName,
      files,
      target: "production",
      framework: "vite",
    });

    activeDeploys.set(projectDbId, {
      status: "deploying",
      projectName,
      startedAt,
      deploymentId: deployment.id,
    });

    const ready = await waitForDeploymentReady(deployment.id);
    const deploymentUrl = ready.url
      ? `https://${ready.url}`
      : deployment.url
        ? `https://${deployment.url}`
        : "";
    const alias = ready.alias?.[0];
    const productionUrl = alias ? `https://${alias}` : deploymentUrl;

    const nextIntegration = {
      projectId,
      projectName,
      productionUrl,
      lastDeploymentUrl: deploymentUrl,
      lastDeploymentId: ready.id,
      lastDeployedAt: new Date().toISOString(),
    };
    await setVercelIntegrationForOwner(projectDbId, ownerId, nextIntegration);

    activeDeploys.set(projectDbId, {
      status: "ready",
      projectName,
      startedAt,
      finishedAt: Date.now(),
      deploymentId: ready.id,
      url: productionUrl,
      deploymentUrl,
    });
  } catch (err) {
    const message =
      err instanceof VercelManagementError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    activeDeploys.set(projectDbId, {
      status: "error",
      projectName,
      startedAt,
      finishedAt: Date.now(),
      error: message,
    });
  }
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
      const rawFilter = typeof query.filter === "string" ? query.filter : "active";
      const filter: ProjectListFilter =
        rawFilter === "archived" || rawFilter === "deleted" ? rawFilter : "active";
      const result = await listProjectsForOwner(user.id, {
        q,
        page,
        pageSize,
        filter,
      });
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
        return { error: "Project name is required." };
      }
      const nameErr = projectNameTooLong(name);
      if (nameErr) {
        set.status = 400;
        return nameErr;
      }
      const description = typeof b.description === "string" ? b.description : undefined;
      try {
        const project = await createProject(name, user.id, { description });
        return { data: project };
      } catch (err) {
        set.status = 500;
        return { error: friendlyError(err, { entity: "project", field: "name" }) };
      }
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
      try {
        const project = await createProject(title, user.id, { description });
        return { data: { ...project, name: title, description, title } };
      } catch (err) {
        set.status = 500;
        return { error: friendlyError(err, { entity: "project", field: "name" }) };
      }
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
      if (typeof raw.name === "string") {
        const nameErr = projectNameTooLong(raw.name);
        if (nameErr) {
          set.status = 400;
          return nameErr;
        }
        patch.name = raw.name;
      }
      if (raw.description === null || typeof raw.description === "string") {
        patch.description = raw.description as string | null;
      }
      if (typeof raw.isArchived === "boolean") patch.isArchived = raw.isArchived;
      const perms = parseAgentToolPermissions(raw.agentToolPermissions);
      if (perms !== undefined) patch.agentToolPermissions = perms;
      let updated;
      try {
        updated = await updateProjectForOwner(params.id, user.id, patch);
      } catch (err) {
        set.status = 500;
        return { error: friendlyError(err, { entity: "project", field: "name" }) };
      }
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
      const ok = await softDeleteProjectForOwner(params.id, user.id);
      if (!ok) {
        set.status = 404;
        return { error: "not found" };
      }
      return { data: { id: params.id, deleted: true } };
    })
    .post("/projects/:id/restore", async ({ params, request, set }) => {
      if (!hasDb) return dbUnavailable(set);
      const user = await getUserFromRequest(request);
      if (!user) return unauthorized(set);
      const restored = await restoreProjectForOwner(params.id, user.id);
      if (!restored) {
        set.status = 404;
        return { error: "not found" };
      }
      return { data: toPublicProject(restored) };
    })
    .delete("/projects/:id/permanent", async ({ params, request, set }) => {
      if (!hasDb) return dbUnavailable(set);
      const user = await getUserFromRequest(request);
      if (!user) return unauthorized(set);
      const deleted = await hardDeleteProjectForOwner(params.id, user.id);
      if (!deleted) {
        set.status = 404;
        return { error: "not found" };
      }
      try {
        await rm(join("/tmp/vibe-sandbox", params.id), { recursive: true, force: true });
      } catch {}
      return { data: { id: params.id, deleted: true } };
    })
    .get("/projects/:id/deploy/vercel/status", async ({ params, request, set }) => {
      if (!hasDb) return dbUnavailable(set);
      const user = await getUserFromRequest(request);
      if (!user) return unauthorized(set);
      const project = await getProjectForOwner(params.id, user.id);
      if (!project) {
        set.status = 404;
        return { error: "not found" };
      }

      const active = activeDeploys.get(project.id);
      let integration = project.integrations?.vercel ?? null;

      if (integration?.projectId) {
        try {
          let live = await getVercelProjectById(integration.projectId);
          if (!live && integration.projectName) {
            live = await getVercelProjectByName(integration.projectName);
          }
          if (!live) {
            await clearVercelIntegrationForOwner(project.id, user.id);
            integration = null;
          }
        } catch (err) {
          if (
            err instanceof VercelManagementError &&
            (err.status === 404 || err.status === 410)
          ) {
            await clearVercelIntegrationForOwner(project.id, user.id);
            integration = null;
          }
        }
      }

      if (active && (active.status === "ready" || active.status === "error")) {
        activeDeploys.delete(project.id);
        if (active.status === "ready") {
          const refreshed = await getProjectForOwner(project.id, user.id);
          integration = refreshed?.integrations?.vercel ?? integration;
        }
      }

      return { data: { active: active ?? null, integration } };
    })
    .post("/projects/:id/deploy/vercel", async ({ params, request, set }) => {
      if (!hasDb) return dbUnavailable(set);
      const user = await getUserFromRequest(request);
      if (!user) return unauthorized(set);
      const project = await getProjectForOwner(params.id, user.id);
      if (!project) {
        set.status = 404;
        return { error: "not found" };
      }

      const current = activeDeploys.get(project.id);
      if (current && current.status === "deploying") {
        return { data: { active: current } };
      }

      const [fileRows, designTemplate] = await Promise.all([
        listProjectFiles(project.id),
        getActiveDesignTemplateForProject(project.id, user.id),
      ]);
      const rawFiles: Record<string, string> = {};
      for (const f of fileRows) {
        if (f.isDirectory) continue;
        rawFiles[f.path] = f.content;
      }
      const designCss = designTemplate
        ? templateToCss(
            (designTemplate.parsedTokens ?? {}) as DesignTemplateFrontmatter,
          )
        : null;

      const supabase = project.integrations?.supabase;
      const supabaseInject =
        supabase?.url && supabase?.anonKey
          ? { url: supabase.url, anonKey: supabase.anonKey }
          : null;

      const assembled = assembleVercelProject(rawFiles, {
        supabase: supabaseInject,
        designCss,
      });

      const vercelFiles = Object.entries(assembled).map(([path, content]) => ({
        file: path,
        data: content,
        encoding: "utf-8" as const,
      }));

      const existingVercel = project.integrations?.vercel;
      const nameSlug = slugifyProjectName(project.name) || "app";
      const projectName =
        existingVercel?.projectName ?? `${nameSlug}-${randomProjectSuffix()}`;

      const initial: DeployProgress = {
        status: "deploying",
        projectName,
        startedAt: Date.now(),
      };
      activeDeploys.set(project.id, initial);

      runVercelDeploy({
        projectDbId: project.id,
        ownerId: user.id,
        projectName,
        existingVercel: existingVercel ?? null,
        files: vercelFiles,
      }).catch(() => {});

      return { data: { active: initial } };
    });
