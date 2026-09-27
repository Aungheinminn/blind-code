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

type DesignAgentIncoming =
  | {
      type: "run";
      model: string;
      prompt: string;
      history?: DesignAgentChatMessage[];
      initialDraft?: string | null;
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

      ws.send({ type: "started", provider, model: resolvedModelId });

      const runSignal: AbortSignal | undefined = (ws.data as any).abort?.signal;

      const forward = (event: DesignAgentEvent) => {
        try {
          ws.send(event);
        } catch {}
      };

      try {
        await runDesignAgent({
          provider,
          model: resolvedModelId,
          ownerUserId: userId,
          prompt,
          history: msg.history,
          initialDraft: msg.initialDraft ?? null,
          signal: runSignal,
          onEvent: forward,
        });
      } catch (err) {
        if (!runSignal?.aborted) {
          forward({ type: "error", error: extractErrorMessage(err) });
        }
      }

      try {
        ws.send({ type: "done" });
      } catch {}
    },
  });
