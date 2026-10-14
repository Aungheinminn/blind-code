import type { Elysia } from "elysia";
import { providerForModel } from "@vibe/shared";
import { getUserFromRequest } from "../services/authGuard";
import { consumeTicket } from "../services/wsTicket";
import {
  runDesignAgent,
  type DesignAgentChatMessage,
  type DesignAgentEvent,
} from "../services/designAgent";
import { extractErrorMessage } from "../services/coder";
import { creditsFor, hasPricing } from "../services/pricing";
import { debit, getBalance } from "../services/credits";
import { resolveKey } from "../services/providers";

type DesignAgentIncoming =
  | {
      type: "run";
      model: string;
      prompt: string;
      history?: DesignAgentChatMessage[];
      initialDraft?: string | null;
      editingTemplateId?: string | null;
      editingTemplateName?: string | null;
    }
  | { type: "cancel" };

export const designAgentController = (app: Elysia) =>
  app.ws("/ws/design-agent", {
    open: async (ws) => {
      const data = ws.data as any;
      const req: Request | undefined = data.request;
      const url = req ? new URL(req.url) : null;
      const ticketParam = url?.searchParams.get("ticket") ?? null;
      const ticketUserId = ticketParam ? consumeTicket(ticketParam) : null;
      let userId: string | null = ticketUserId;
      if (!userId && req) {
        const user = await getUserFromRequest(req);
        userId = user?.id ?? null;
      }
      if (!userId) {
        ws.send({ type: "error", error: "unauthorized" });
        ws.close();
        return;
      }
      data.userId = userId;
      data.abort = new AbortController();
    },
    close: (ws) => {
      (ws.data as any).abort?.abort();
    },
    message: async (ws, raw) => {
      const msg = raw as DesignAgentIncoming;
      const userId: string | undefined = (ws.data as any).userId;
      if (!userId) {
        ws.send({ type: "error", error: "unauthorized" });
        ws.close();
        return;
      }

      if (msg.type === "cancel") {
        (ws.data as any).abort?.abort();
        (ws.data as any).abort = new AbortController();
        ws.send({ type: "cancelled" });
        return;
      }

      if (msg.type !== "run") return;

      const resolvedModelId = msg.model?.trim();
      if (!resolvedModelId) {
        ws.send({ type: "error", error: "model required" });
        return;
      }
      const provider = providerForModel(resolvedModelId);
      if (!provider) {
        ws.send({ type: "error", error: `unknown model: ${resolvedModelId}` });
        return;
      }
      const prompt = typeof msg.prompt === "string" ? msg.prompt : "";
      if (!prompt.trim()) {
        ws.send({ type: "error", error: "prompt required" });
        return;
      }

      // Credits pre-flight. Only enforces when the resolved source would be
      // the platform env — a user with their own key configured runs free.
      if (hasPricing(resolvedModelId)) {
        try {
          const preflightKey = await resolveKey(provider, userId);
          if (preflightKey?.source === "env") {
            const balance = await getBalance(userId);
            if (balance <= 0) {
              ws.send({
                type: "error",
                error:
                  "Out of credits. Add your own API key in Settings → Providers to run for free, or top up on Settings → Credits.",
              });
              return;
            }
          }
        } catch (err) {
          console.warn("[credits] design-agent pre-flight check failed, allowing run:", err);
        }
      }

      ws.send({ type: "started", provider, model: resolvedModelId });

      const runSignal: AbortSignal | undefined = (ws.data as any).abort?.signal;

      const forward = (event: DesignAgentEvent) => {
        try {
          ws.send(event);
        } catch {}
      };

      const editingTemplateId =
        typeof msg.editingTemplateId === "string" && msg.editingTemplateId.trim()
          ? msg.editingTemplateId.trim()
          : null;
      const editingTemplateName =
        typeof msg.editingTemplateName === "string" && msg.editingTemplateName.trim()
          ? msg.editingTemplateName.trim()
          : null;

      let runResult: Awaited<ReturnType<typeof runDesignAgent>> | null = null;
      try {
        runResult = await runDesignAgent({
          provider,
          model: resolvedModelId,
          ownerUserId: userId,
          prompt,
          history: msg.history,
          initialDraft: msg.initialDraft ?? null,
          editingTemplateName,
          signal: runSignal,
          onEvent: forward,
        });
      } catch (err) {
        if (!runSignal?.aborted) {
          forward({ type: "error", error: extractErrorMessage(err) });
        }
      }

      // Debit credits for platform-key usage. User-key usage is free.
      // Fail-safe: a debit failure never breaks the turn — we log and move on.
      if (
        runResult &&
        (runResult.inputTokens > 0 || runResult.outputTokens > 0) &&
        hasPricing(resolvedModelId)
      ) {
        try {
          const resolved = await resolveKey(provider, userId);
          if (resolved?.source === "env") {
            const credits = creditsFor(resolvedModelId, {
              inputTokens: runResult.inputTokens,
              outputTokens: runResult.outputTokens,
            });
            if (credits > 0) {
              await debit(userId, credits, "agent_run", {
                provider,
                model: resolvedModelId,
                inputTokens: runResult.inputTokens,
                outputTokens: runResult.outputTokens,
                note: "design_agent",
                ...(editingTemplateId ? { designTemplateId: editingTemplateId } : {}),
                ...(runResult.templateName
                  ? { designTemplateName: runResult.templateName }
                  : {}),
              });
            }
          }
        } catch (err) {
          console.warn("[credits] debit after design agent run failed:", err);
        }
      }

      try {
        ws.send({ type: "done" });
      } catch {}
    },
  });
