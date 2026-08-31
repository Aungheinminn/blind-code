import type { Elysia } from "elysia";
import { runAgent, type AgentChatMessage } from "../services/agent";
import { listAvailableProviders } from "../services/providers";

type AgentIncoming =
  | {
      type: "run";
      provider: string;
      model?: string;
      projectId: string;
      prompt: string;
      history?: AgentChatMessage[];
      maxSteps?: number;
      systemPrompt?: string;
    }
  | { type: "cancel" };

export const agentController = (app: Elysia) =>
  app
    .get("/agent/providers", () => ({ data: listAvailableProviders() }))
    .ws("/ws/agent", {
      open: (ws) => {
        (ws.data as any).abort = new AbortController();
      },
      close: (ws) => {
        (ws.data as any).abort?.abort();
      },
      message: async (ws, raw) => {
        const msg = raw as AgentIncoming;

        if (msg.type === "cancel") {
          (ws.data as any).abort?.abort();
          (ws.data as any).abort = new AbortController();
          ws.send({ type: "cancelled" });
          return;
        }

        if (msg.type !== "run") return;

        ws.send({ type: "started", provider: msg.provider, model: msg.model ?? null });

        await runAgent({
          provider: msg.provider,
          model: msg.model,
          projectId: msg.projectId,
          prompt: msg.prompt,
          history: msg.history,
          maxSteps: msg.maxSteps,
          systemPrompt: msg.systemPrompt,
          signal: (ws.data as any).abort?.signal,
          onEvent: (event) => {
            try {
              ws.send(event);
            } catch {}
          },
        });

        ws.send({ type: "done" });
      },
    });
