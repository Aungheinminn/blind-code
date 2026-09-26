import type { Elysia } from "elysia";
import { z } from "zod";
import { getUserFromRequest } from "../services/authGuard";
import {
  listAvailableProviders,
  PROVIDERS,
  type ProviderName,
} from "../services/providers";
import { removeStoredKey, setStoredKey } from "../services/authStore";

const providerParam = z.enum(
  Object.keys(PROVIDERS) as [ProviderName, ...ProviderName[]],
);

const keyBody = z.object({
  apiKey: z.string().trim().min(1, "apiKey required"),
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

export const connectController = (app: Elysia) =>
  app
    .get("/connect", async ({ request, set }) => {
      const user = await getUserFromRequest(request);
      if (!user) return unauthorized(set);
      const providers = await listAvailableProviders();
      return { data: { providers } };
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
    });
