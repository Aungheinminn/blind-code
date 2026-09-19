import type { Elysia } from "elysia";
import { getUserFromRequest } from "../services/authGuard";
import { hasDb } from "../db/client";
import {
  getUserById,
  setUserSupabaseIntegration,
  clearUserSupabaseIntegration,
} from "../db/repo";
import {
  listSupabaseProjects,
  listSupabaseOrganizations,
  createSupabaseProject,
  validatePat,
  SupabaseManagementError,
} from "../services/supabaseManagement";
import { toPublicUserIntegrations } from "@vibe/shared";

const unauthorized = (set: { status?: number | string }) => {
  set.status = 401;
  return { error: "unauthorized" };
};

const dbUnavailable = (set: { status?: number | string }) => {
  set.status = 503;
  return { error: "database not configured" };
};

const notConnected = (set: { status?: number | string }) => {
  set.status = 400;
  return { error: "Supabase account not connected" };
};

export const accountController = (app: Elysia) =>
  app
    .get("/account/integrations", async ({ request, set }) => {
      if (!hasDb) return dbUnavailable(set);
      const user = await getUserFromRequest(request);
      if (!user) return unauthorized(set);
      const row = await getUserById(user.id);
      return { data: toPublicUserIntegrations(row?.integrations) };
    })
    .put("/account/integrations/supabase", async ({ body, request, set }) => {
      if (!hasDb) return dbUnavailable(set);
      const user = await getUserFromRequest(request);
      if (!user) return unauthorized(set);
      const b = (body as Record<string, unknown>) ?? {};
      const accessToken =
        typeof b.accessToken === "string" ? b.accessToken.trim() : "";
      if (!accessToken) {
        set.status = 400;
        return { error: "accessToken required" };
      }
      const ok = await validatePat(accessToken);
      if (!ok) {
        set.status = 400;
        return { error: "Personal access token was rejected by Supabase" };
      }
      const updated = await setUserSupabaseIntegration(user.id, {
        accessToken,
        connectedAt: new Date().toISOString(),
      });
      if (!updated) {
        set.status = 404;
        return { error: "user not found" };
      }
      return { data: toPublicUserIntegrations(updated.integrations) };
    })
    .delete("/account/integrations/supabase", async ({ request, set }) => {
      if (!hasDb) return dbUnavailable(set);
      const user = await getUserFromRequest(request);
      if (!user) return unauthorized(set);
      const updated = await clearUserSupabaseIntegration(user.id);
      if (!updated) {
        set.status = 404;
        return { error: "user not found" };
      }
      return { data: toPublicUserIntegrations(updated.integrations) };
    })
    .get("/account/integrations/supabase/projects", async ({ request, set }) => {
      if (!hasDb) return dbUnavailable(set);
      const user = await getUserFromRequest(request);
      if (!user) return unauthorized(set);
      const row = await getUserById(user.id);
      const pat = row?.integrations?.supabase?.accessToken;
      if (!pat) return notConnected(set);
      try {
        const projects = await listSupabaseProjects(pat);
        return { data: projects };
      } catch (err) {
        if (err instanceof SupabaseManagementError) {
          set.status = err.status === 401 ? 401 : 502;
          return { error: err.message };
        }
        set.status = 502;
        return { error: err instanceof Error ? err.message : String(err) };
      }
    })
    .post("/account/integrations/supabase/projects", async ({ body, request, set }) => {
      if (!hasDb) return dbUnavailable(set);
      const user = await getUserFromRequest(request);
      if (!user) return unauthorized(set);
      const row = await getUserById(user.id);
      const pat = row?.integrations?.supabase?.accessToken;
      if (!pat) return notConnected(set);

      const b = (body as Record<string, unknown>) ?? {};
      const name = typeof b.name === "string" ? b.name.trim() : "";
      const organizationSlug =
        typeof b.organizationSlug === "string" ? b.organizationSlug.trim() : "";
      const regionCode =
        typeof b.regionCode === "string" ? b.regionCode.trim() : "";
      const dbPass = typeof b.dbPass === "string" ? b.dbPass : "";
      if (!name) {
        set.status = 400;
        return { error: "name required" };
      }
      if (!organizationSlug) {
        set.status = 400;
        return { error: "organizationSlug required" };
      }
      if (!regionCode) {
        set.status = 400;
        return { error: "regionCode required" };
      }
      if (!dbPass || dbPass.length < 8) {
        set.status = 400;
        return { error: "dbPass required (min 8 chars)" };
      }
      try {
        const created = await createSupabaseProject(pat, {
          name,
          organizationSlug,
          dbPass,
          regionCode,
        });
        return { data: created };
      } catch (err) {
        if (err instanceof SupabaseManagementError) {
          set.status = err.status === 401 ? 401 : err.status === 402 ? 402 : 502;
          return { error: err.message };
        }
        set.status = 502;
        return { error: err instanceof Error ? err.message : String(err) };
      }
    })
    .get("/account/integrations/supabase/organizations", async ({ request, set }) => {
      if (!hasDb) return dbUnavailable(set);
      const user = await getUserFromRequest(request);
      if (!user) return unauthorized(set);
      const row = await getUserById(user.id);
      const pat = row?.integrations?.supabase?.accessToken;
      if (!pat) return notConnected(set);
      try {
        const orgs = await listSupabaseOrganizations(pat);
        return { data: orgs };
      } catch (err) {
        if (err instanceof SupabaseManagementError) {
          set.status = err.status === 401 ? 401 : 502;
          return { error: err.message };
        }
        set.status = 502;
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });
