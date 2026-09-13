import type { Elysia } from "elysia";
import { join, dirname } from "path";
import { mkdir, writeFile } from "fs/promises";
import {
  extractErrorMessage,
  runCoder,
  type CoderChatMessage,
  type CoderEvent,
} from "../services/coder";
import { runPlanner, type Plan } from "../services/planner";
import { listAvailableProviders, PROVIDERS, type ProviderName } from "../services/providers";
import { getUserFromRequest } from "../services/authGuard";
import { consumeTicket } from "../services/wsTicket";
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
      history?: CoderChatMessage[];
      maxSteps?: number;
      systemPrompt?: string;
      usePlan?: boolean;
      plannerMaxSteps?: number;
    }
  | { type: "cancel" }
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
    .get("/agent/providers", async () => ({ data: await listAvailableProviders() }))
    .ws("/ws/agent", {
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
        data.unsubscribes = [];
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

        const dbProject = await ensureProject(msg.projectId, userId);
        if (dbProject?.forbidden) {
          ws.send({ type: "error", error: "forbidden" });
          return;
        }
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

        const textBlocks = new Map<string, string>();
        const reasoningBlocks = new Map<string, string>();
        const pendingWrites = new Map<string, { path: string; content: string }>();
        const pendingDeletes = new Map<string, { path: string }>();

        const persistBlock = async (
          kind: "assistant_text" | "assistant_reasoning",
          id: string,
          text: string,
        ) => {
          if (!sessionId || !text) return;
          await recordAgentAction(sessionId, kind, {
            summary: text.slice(0, 200),
            payload: { text, blockId: id },
          });
        };

        const flushTextBlock = async (id: string) => {
          const text = textBlocks.get(id);
          textBlocks.delete(id);
          if (text) await persistBlock("assistant_text", id, text);
        };

        const flushReasoningBlock = async (id: string) => {
          const text = reasoningBlocks.get(id);
          reasoningBlocks.delete(id);
          if (text) await persistBlock("assistant_reasoning", id, text);
        };

        const flushAllBlocks = async () => {
          for (const id of [...textBlocks.keys()]) await flushTextBlock(id);
          for (const id of [...reasoningBlocks.keys()]) await flushReasoningBlock(id);
        };

        const publish = async (event: CoderEvent | Record<string, unknown>) => {
          const ordinal = turnId ? await turnBus.emit(turnId, event as any) : null;
          try {
            ws.send(turnId ? { ...event, ordinal, turnId } : event);
          } catch {}
        };

        let plan: Plan | null = null;
        if (msg.usePlan) {
          try {
            plan = await runPlanner({
              provider: msg.provider,
              model: msg.model,
              toolContext: {
                sandboxProjectId: msg.projectId,
                dbProjectId,
                sessionId: null,
              },
              prompt: msg.prompt,
              history: msg.history,
              maxSteps: msg.plannerMaxSteps,
              signal: (ws.data as any).abort?.signal,
            });
            await publish({ type: "plan", plan });
            if (sessionId) {
              await recordAgentAction(sessionId, "plan", {
                summary: plan.summary.slice(0, 200),
                payload: { plan },
              });
            }
          } catch (err) {
            console.error("[planner] failed", err);
            await publish({ type: "plan-error", error: extractErrorMessage(err) });
          }
        }

        const handleEvent = async (event: CoderEvent) => {
          await publish(event);
          if (event.type === "tool-call") {
            if (event.toolName === "write_file") {
              const input = event.input as { path?: string; content?: string } | undefined;
              if (typeof input?.path === "string" && typeof input?.content === "string") {
                pendingWrites.set(event.toolCallId, { path: input.path, content: input.content });
              }
            } else if (event.toolName === "delete_file") {
              const input = event.input as { path?: string } | undefined;
              if (typeof input?.path === "string") {
                pendingDeletes.set(event.toolCallId, { path: input.path });
              }
            }
          } else if (event.type === "tool-result") {
            const outputHasPath =
              event.output != null &&
              typeof event.output === "object" &&
              typeof (event.output as { path?: unknown }).path === "string";
            if (event.toolName === "write_file" && outputHasPath) {
              const pending = pendingWrites.get(event.toolCallId);
              if (pending) {
                pendingWrites.delete(event.toolCallId);
                await publish({
                  type: "file-updated",
                  path: pending.path,
                  content: pending.content,
                });
              }
            } else if (event.toolName === "delete_file" && outputHasPath) {
              const pending = pendingDeletes.get(event.toolCallId);
              if (pending) {
                pendingDeletes.delete(event.toolCallId);
                await publish({ type: "file-deleted", path: pending.path });
              }
            }
          }
          if (!sessionId) return;
          switch (event.type) {
            case "text-start":
              textBlocks.set(event.id, "");
              break;
            case "text-delta":
              textBlocks.set(event.id, (textBlocks.get(event.id) ?? "") + event.text);
              break;
            case "text-end":
              await flushTextBlock(event.id);
              break;
            case "reasoning-start":
              reasoningBlocks.set(event.id, "");
              break;
            case "reasoning-delta":
              reasoningBlocks.set(
                event.id,
                (reasoningBlocks.get(event.id) ?? "") + event.text,
              );
              break;
            case "reasoning-end":
              await flushReasoningBlock(event.id);
              break;
            case "tool-call":
              await flushAllBlocks();
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
              await flushAllBlocks();
              break;
            case "finish":
              await flushAllBlocks();
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
          await runCoder({
            provider: msg.provider,
            model: msg.model,
            toolContext: { sandboxProjectId: msg.projectId, dbProjectId, sessionId },
            prompt: msg.prompt,
            history: msg.history,
            maxSteps: msg.maxSteps,
            systemPrompt: msg.systemPrompt,
            plan,
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
          terminalError = extractErrorMessage(err);
        }

        await flushAllBlocks();
        if (sessionId) await endAgentSession(sessionId);
        if (turnId) await turnBus.finishTurn(turnId, terminalStatus, terminalError);

        await publish({ type: "done" });
      },
    });
