import type { Elysia } from "elysia";
import { z } from "zod";
import { getUserFromRequest } from "../services/authGuard";
import {
  listAvailableProviders,
  PROVIDERS,
  type ProviderName,
} from "../services/providers";
import { DEFAULT_ENABLED, MODEL_CATALOG } from "../services/modelCatalog";
import {
  getStoredEnabledModels,
  removeStoredKey,
  setStoredEnabledModels,
  setStoredKey,
} from "../services/authStore";

const providerParam = z.enum(
  Object.keys(PROVIDERS) as [ProviderName, ...ProviderName[]],
);

const keyBody = z.object({
  apiKey: z.string().trim().min(1, "apiKey required"),
});

const modelsBody = z.object({
  modelIds: z.array(z.string().trim().min(1)).max(50),
});

const unauthorized = (set: { status?: number | string }) => {
  set.status = 401;
  return { error: "unauthorized" };
};

const badRequest = (set: { status?: number | string }, msg: string) => {
  set.status = 400;
  return { error: msg };
};

const notFound = (set: { status?: number | string }) => {
  set.status = 404;
  return { error: "unknown provider" };
};

const buildEnabledByProvider = async (): Promise<Record<ProviderName, string[]>> => {
  const out = {} as Record<ProviderName, string[]>;
  for (const name of Object.keys(PROVIDERS) as ProviderName[]) {
    const stored = await getStoredEnabledModels(name);
    out[name] = stored ?? DEFAULT_ENABLED[name] ?? [];
  }
  return out;
};

export const connectController = (app: Elysia) =>
  app
    .get("/connect", async ({ request, set }) => {
      const user = await getUserFromRequest(request);
      if (!user) return unauthorized(set);
      const [providers, enabledByProvider] = await Promise.all([
        listAvailableProviders(),
        buildEnabledByProvider(),
      ]);
      return {
        data: {
          providers,
          catalogByProvider: MODEL_CATALOG,
          enabledByProvider,
        },
      };
    })
    .put("/connect/:provider/key", async ({ params, body, request, set }) => {
      const user = await getUserFromRequest(request);
      if (!user) return unauthorized(set);
      const p = providerParam.safeParse(params.provider);
      if (!p.success) return notFound(set);
      const parsed = keyBody.safeParse(body);
      if (!parsed.success) {
        return badRequest(set, parsed.error.issues[0]?.message ?? "invalid input");
      }
      await setStoredKey(p.data, parsed.data.apiKey);
      return { data: { provider: p.data, saved: true } };
    })
    .delete("/connect/:provider/key", async ({ params, request, set }) => {
      const user = await getUserFromRequest(request);
      if (!user) return unauthorized(set);
      const p = providerParam.safeParse(params.provider);
      if (!p.success) return notFound(set);
      const removed = await removeStoredKey(p.data);
      return { data: { provider: p.data, removed } };
    })
    .put("/connect/:provider/models", async ({ params, body, request, set }) => {
      const user = await getUserFromRequest(request);
      if (!user) return unauthorized(set);
      const p = providerParam.safeParse(params.provider);
      if (!p.success) return notFound(set);
      const parsed = modelsBody.safeParse(body);
      if (!parsed.success) {
        return badRequest(set, parsed.error.issues[0]?.message ?? "invalid input");
      }
      const cleaned = [...new Set(parsed.data.modelIds.map((id) => id.trim()).filter(Boolean))];
      await setStoredEnabledModels(p.data, cleaned);
      return { data: { provider: p.data, count: cleaned.length } };
    });
