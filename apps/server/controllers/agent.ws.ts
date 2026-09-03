import type { Elysia } from "elysia";
import { join, dirname } from "path";
import { mkdir, writeFile } from "fs/promises";
import { runAgent, type AgentChatMessage, type AgentEvent } from "../services/agent";
import { listAvailableProviders, PROVIDERS, type ProviderName } from "../services/providers";
import { isAuthorized } from "../services/auth";
import { previewManager } from "../services/preview";
import { turnBus } from "../services/turnBus";
import {
  ensureProject,
  createAgentSession,
  endAgentSession,
  recordAgentAction,
  listProjectFiles,
  hasDb,
} from "../db/repo";

const SANDBOX_ROOT = "/tmp/vibe-sandbox";

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
      autoPreview?: boolean;
    }
  | { type: "cancel" }
  | { type: "restart-preview"; projectId: string }
  | { type: "attach"; turnId: string; lastOrdinal?: number };

const hydrateSandbox = async (sandboxProjectId: string, dbProjectId: string | null) => {
  const cwd = join(SANDBOX_ROOT, sandboxProjectId);
  await mkdir(cwd, { recursive: true });
  if (!dbProjectId || !hasDb) return;

  const files = await listProjectFiles(dbProjectId);
  for (const f of files) {
    if (f.isDirectory) continue;
    const abs = join(cwd, f.path);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, f.content, "utf-8");
  }
};

export const agentController = (app: Elysia) =>
  app
    .get("/agent/providers", () => ({ data: listAvailableProviders() }))
    .ws("/ws/agent", {
      open: (ws) => {
        const url = (ws.data as any).request?.url;
        if (!isAuthorized(url)) {
          ws.send({ type: "error", error: "unauthorized" });
          ws.close();
          return;
        }
        (ws.data as any).abort = new AbortController();
        (ws.data as any).unsubscribes = [];
      },
      close: (ws) => {
        (ws.data as any).abort?.abort();
        const unsubs: Array<() => void> = (ws.data as any).unsubscribes ?? [];
        for (const u of unsubs) {
          try {
            u();
          } catch {}
        }
        (ws.data as any).unsubscribes = [];
      },
      message: async (ws, raw) => {
        const msg = raw as AgentIncoming;

        if (msg.type === "cancel") {
          (ws.data as any).abort?.abort();
          (ws.data as any).abort = new AbortController();
          ws.send({ type: "cancelled" });
          return;
        }

        if (msg.type === "restart-preview") {
          previewManager.stop(msg.projectId);
          const status = await previewManager.ensureRunning(msg.projectId, (s) =>
            ws.send({ type: "preview", status: s }),
          );
          ws.send({ type: "preview", status });
          return;
        }

        if (msg.type === "attach") {
          const turn = await turnBus.getTurn(msg.turnId);
          if (!turn) {
            ws.send({ type: "error", error: "unknown turnId" });
            return;
          }
          const missed = await turnBus.getEventsSince(msg.turnId, msg.lastOrdinal ?? -1);
          for (const rec of missed) {
            ws.send({ ...rec.payload, ordinal: rec.ordinal, turnId: msg.turnId });
          }
          if (turn.status === "running") {
            const unsub = turnBus.subscribe(msg.turnId, (rec) => {
              try {
                ws.send({ ...rec.payload, ordinal: rec.ordinal, turnId: msg.turnId });
              } catch {}
            });
            (ws.data as any).unsubscribes.push(unsub);
          } else {
            ws.send({
              type: "turn-terminal",
              turnId: msg.turnId,
              status: turn.status,
              lastError: turn.lastError,
            });
          }
          return;
        }

        if (msg.type !== "run") return;

        const dbProject = await ensureProject(msg.projectId);
        const dbProjectId = dbProject?.id ?? null;

        await hydrateSandbox(msg.projectId, dbProjectId);

        const resolvedModelId =
          msg.model?.trim() || PROVIDERS[msg.provider as ProviderName]?.defaultModel || "unknown";
        const sessionId = dbProjectId
          ? await createAgentSession(dbProjectId, `${msg.provider}/${resolvedModelId}`)
          : null;

        const turnId =
          sessionId && dbProjectId ? await turnBus.createTurn(sessionId, dbProjectId) : null;

        ws.send({
          type: "started",
          provider: msg.provider,
          model: msg.model ?? null,
          sessionId,
          dbProjectId,
          turnId,
        });

        if (sessionId) {
          await recordAgentAction(sessionId, "user_prompt", {
            summary: msg.prompt.slice(0, 200),
            payload: { prompt: msg.prompt },
          });
        }

        let currentText = "";
        const flushText = async () => {
          if (!sessionId || !currentText) return;
          await recordAgentAction(sessionId, "assistant_text", {
            summary: currentText.slice(0, 200),
            payload: { text: currentText },
          });
          currentText = "";
        };

        const publish = async (event: AgentEvent | Record<string, unknown>) => {
          const ordinal = turnId ? await turnBus.emit(turnId, event as any) : null;
          try {
            ws.send(turnId ? { ...event, ordinal, turnId } : event);
          } catch {}
        };

        const handleEvent = async (event: AgentEvent) => {
          await publish(event);
          if (!sessionId) return;
          switch (event.type) {
            case "text-delta":
              currentText += event.text;
              break;
            case "tool-call":
              await flushText();
              await recordAgentAction(sessionId, `tool_call:${event.toolName}`, {
                summary: `${event.toolName}`,
                payload: { input: event.input, toolCallId: event.toolCallId },
              });
              break;
            case "tool-result":
              await recordAgentAction(sessionId, `tool_result:${event.toolName}`, {
                summary: `${event.toolName} result`,
                payload: { output: event.output, toolCallId: event.toolCallId },
              });
              break;
            case "step-finish":
              await flushText();
              break;
            case "finish":
              await flushText();
              await recordAgentAction(sessionId, "finish", {
                summary: event.finishReason,
                payload: { finishReason: event.finishReason, usage: event.usage },
              });
              break;
            case "error":
              await recordAgentAction(sessionId, "error", {
                summary: event.error.slice(0, 200),
                payload: { error: event.error },
              });
              break;
          }
        };

        let terminalStatus: "done" | "failed" | "cancelled" = "done";
        let terminalError: string | null = null;

        try {
          await runAgent({
            provider: msg.provider,
            model: msg.model,
            toolContext: { sandboxProjectId: msg.projectId, dbProjectId, sessionId },
            prompt: msg.prompt,
            history: msg.history,
            maxSteps: msg.maxSteps,
            systemPrompt: msg.systemPrompt,
            signal: (ws.data as any).abort?.signal,
            onEvent: (event) => {
              handleEvent(event).catch(() => {});
              if (event.type === "error") {
                terminalStatus = "failed";
                terminalError = event.error;
              }
            },
          });
          if ((ws.data as any).abort?.signal?.aborted) {
            terminalStatus = "cancelled";
          }
        } catch (err) {
          terminalStatus = "failed";
          terminalError = err instanceof Error ? err.message : String(err);
        }

        await flushText();
        if (sessionId) await endAgentSession(sessionId);
        if (turnId) await turnBus.finishTurn(turnId, terminalStatus, terminalError);

        await publish({ type: "done" });

        if (msg.autoPreview !== false) {
          previewManager.stop(msg.projectId);
          const status = await previewManager.ensureRunning(msg.projectId, (s) =>
            ws.send({ type: "preview", status: s }),
          );
          ws.send({ type: "preview", status });
        }
      },
    });
