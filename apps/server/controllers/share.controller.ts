import type { Elysia } from "elysia";
import type { DesignTemplateFrontmatter } from "@vibe/shared";
import { hasDb } from "../db/client";
import { getActiveDesignTemplateForProject, getProjectByShareToken, listProjectFiles } from "../db/repo";
import { templateToCss } from "../services/designTemplate";

const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

// Public, no auth: anyone holding the link can view the project's preview.
// Returns only what the preview needs; the Supabase anon key is included
// because the running app needs it, and it's public by design.
export const shareController = (app: Elysia) =>
  app.get("/share/:token", async ({ params, set }) => {
    if (!hasDb) {
      set.status = 503;
      return { error: "database not configured" };
    }
    const project = TOKEN_RE.test(params.token) ? await getProjectByShareToken(params.token) : null;
    if (!project) {
      set.status = 404;
      return { error: "This link doesn't exist or was turned off." };
    }
    const [rows, template] = await Promise.all([
      listProjectFiles(project.id),
      getActiveDesignTemplateForProject(project.id, project.ownerId),
    ]);
    const files: Record<string, string> = {};
    for (const f of rows) if (!f.isDirectory) files[f.path] = f.content;
    const supabase = project.integrations?.supabase;
    return {
      data: {
        name: project.name,
        description: project.description,
        files,
        designCss: template
          ? templateToCss((template.parsedTokens ?? {}) as DesignTemplateFrontmatter)
          : null,
        supabase:
          supabase?.url && supabase?.anonKey ? { url: supabase.url, anonKey: supabase.anonKey } : null,
      },
    };
  });
