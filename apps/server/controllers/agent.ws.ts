import type { Elysia } from "elysia";
import { join, dirname } from "path";
import { mkdir, writeFile } from "fs/promises";
import {
  extractErrorMessage,
  type CoderChatMessage,
  type CoderEvent,
} from "../services/coder";
import { runAgent, type AgentEvent } from "../services/agent";
import { listAvailableProviders } from "../services/providers";
import { providerForModel } from "@vibe/shared";
import { getUserFromRequest } from "../services/authGuard";
import { consumeTicket } from "../services/wsTicket";
import { turnBus } from "../services/turnBus";
import {
  ensureProject,
  createAgentSession,
  endAgentSession,
  recordAgentAction,
  createPlan,
  updateTodoStatus,
  getLatestPlanForProject,
  listProjectFiles,
  getProjectForOwner,
  getUserById,
  getActiveDesignTemplateForProject,
  hasDb,
} from "../db/repo";
import { sanitizeTemplateBody } from "../services/designTemplate";
import matter from "gray-matter";
import type { Plan } from "../services/planner";
import { resolveAgentToolPermissions, type PlanTodoStatus } from "@vibe/shared";

const SANDBOX_ROOT = "/tmp/vibe-sandbox";

type AgentIncoming =
  | {
      type: "run";
      model: string;
      projectId: string;
      prompt: string;
      history?: CoderChatMessage[];
      persistPrompt?: boolean;
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

        const [projectRow, userRow, activeTemplate] = await Promise.all([
          dbProjectId ? getProjectForOwner(dbProjectId, userId) : Promise.resolve(null),
          getUserById(userId),
          dbProjectId
            ? getActiveDesignTemplateForProject(dbProjectId, userId)
            : Promise.resolve(null),
        ]);
        const templateName = activeTemplate?.name ?? null;
        const templateBody = activeTemplate?.content
          ? sanitizeTemplateBody(matter(activeTemplate.content).content)
          : null;
        const supabase = projectRow?.integrations?.supabase ?? null;
        const supabaseConnected = Boolean(supabase);
        const supabaseDatabaseUrl = supabase?.databaseUrl ?? null;
        const supabaseProjectRef = supabase?.projectRef ?? null;
        const supabasePat = userRow?.integrations?.supabase?.accessToken ?? null;
        const supabaseCanRunSqlViaMgmt = Boolean(supabasePat && supabaseProjectRef);
        const supabaseCanRunSql =
          supabaseCanRunSqlViaMgmt || Boolean(supabaseDatabaseUrl);
        const resolvedPerms = resolveAgentToolPermissions(
          projectRow?.agentToolPermissions ?? null,
        );
        // Auto-provision guidance only makes sense when the agent can do BOTH.
        const canAutoProvisionSupabase =
          Boolean(supabasePat) &&
          resolvedPerms.create_supabase_project &&
          resolvedPerms.attach_supabase_project;

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
        const sessionId = dbProjectId
          ? await createAgentSession(dbProjectId, `${provider}/${resolvedModelId}`)
          : null;

        const turnId =
          sessionId && dbProjectId ? await turnBus.createTurn(sessionId, dbProjectId) : null;

        ws.send({
          type: "started",
          provider,
          model: resolvedModelId,
          sessionId,
          dbProjectId,
          turnId,
        });

        if (sessionId && msg.persistPrompt !== false) {
          await recordAgentAction(sessionId, "user_prompt", {
            summary: msg.prompt.slice(0, 200),
            payload: { prompt: msg.prompt },
          });
        }

        const textBlocks = new Map<string, string>();
        const pendingWrites = new Map<string, { path: string; content: string }>();
        const pendingDeletes = new Map<string, { path: string }>();

        const persistBlock = async (id: string, text: string) => {
          if (!sessionId || !text) return;
          await recordAgentAction(sessionId, "assistant_text", {
            summary: text.slice(0, 200),
            payload: { text, blockId: id },
          });
        };

        const flushTextBlock = async (id: string) => {
          const text = textBlocks.get(id);
          textBlocks.delete(id);
          if (text) await persistBlock(id, text);
        };

        const flushAllBlocks = async () => {
          for (const id of [...textBlocks.keys()]) await flushTextBlock(id);
        };

        const publish = async (event: CoderEvent | Record<string, unknown>) => {
          const ordinal = turnId ? await turnBus.emit(turnId, event as any) : null;
          try {
            ws.send(turnId ? { ...event, ordinal, turnId } : event);
          } catch {}
        };

        const runSignal: AbortSignal | undefined = (ws.data as any).abort?.signal;

        const handleEvent = async (event: CoderEvent | AgentEvent) => {
          await publish(event);
          if (event.type === "plan" && sessionId && dbProjectId) {
            await createPlan(dbProjectId, sessionId, event.plan);
            return;
          }
          if (event.type === "plan-error" && sessionId) {
            await recordAgentAction(sessionId, "error", {
              summary: `plan-error: ${event.error.slice(0, 180)}`,
              payload: { error: event.error, phase: "planner" },
            });
            return;
          }
          if (event.type === "router-decision" && sessionId) {
            await recordAgentAction(sessionId, "router_decision", {
              summary: event.tool + (event.note ? `: ${event.note.slice(0, 120)}` : ""),
              payload: { tool: event.tool, note: event.note },
            });
            return;
          }
          if (event.type === "verify-result" && sessionId) {
            const issueCount = event.result.issues.length;
            await recordAgentAction(sessionId, "verify_result", {
              summary: event.result.ok
                ? `verified ok (${issueCount} issues)`
                : `verify failed (${issueCount} issues)`,
              payload: { result: event.result },
            });
            return;
          }
          if (event.type === "verify-error" && sessionId) {
            await recordAgentAction(sessionId, "error", {
              summary: `verify-error: ${event.error.slice(0, 180)}`,
              payload: { error: event.error, phase: "verifier" },
            });
            return;
          }
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
            } else if (event.toolName === "update_todo" && sessionId) {
              const input = event.input as
                | { id?: string; status?: PlanTodoStatus; note?: string }
                | undefined;
              if (input?.id && input.status) {
                await updateTodoStatus(sessionId, input.id, input.status, input.note);
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
            } else if (event.toolName === "attach_supabase_project") {
              const out = event.output as
                | { ok?: boolean; projectRef?: string; url?: string; anonKey?: string }
                | null;
              if (out?.ok && out.projectRef && out.url && out.anonKey) {
                await publish({
                  type: "supabase-attached",
                  integration: {
                    url: out.url,
                    anonKey: out.anonKey,
                    projectRef: out.projectRef,
                    hasServiceRoleKey: true,
                    hasDatabaseUrl: false,
                    connectedAt: new Date().toISOString(),
                  },
                });
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

        const toolContext = {
          sandboxProjectId: msg.projectId,
          dbProjectId,
          ownerId: userId,
          sessionId,
          databaseUrl: supabaseDatabaseUrl,
          supabasePat,
          supabaseProjectRef,
        };

        let existingPlan: Plan | null = null;
        let existingPlanStatuses: Record<string, PlanTodoStatus> | undefined;
        if (dbProjectId) {
          const snapshot = await getLatestPlanForProject(dbProjectId);
          if (snapshot) {
            existingPlan = {
              summary: snapshot.summary,
              todos: snapshot.todos.map((t) => ({
                id: t.id,
                title: t.title,
                rationale: t.rationale,
              })),
            };
            existingPlanStatuses = {};
            for (const t of snapshot.todos) existingPlanStatuses[t.id] = t.status;
          }
        }

        const forwardEvent = (event: CoderEvent | AgentEvent) => {
          handleEvent(event).catch(() => {});
          if (event.type === "error") {
            terminalStatus = "failed";
            terminalError = event.error;
          }
        };

        try {
          await runAgent({
            provider,
            model: resolvedModelId,
            toolContext,
            prompt: msg.prompt,
            history: msg.history,
            supabaseConnected,
            supabaseCanRunSql,
            userSupabasePatConnected: canAutoProvisionSupabase,
            agentToolPermissions: resolvedPerms,
            designTemplateName: templateName,
            designTemplateBody: templateBody,
            signal: runSignal,
            existingPlan,
            existingPlanStatuses,
            onEvent: forwardEvent,
          });
          if (runSignal?.aborted) {
            terminalStatus = "cancelled";
          }
        } catch (err) {
          terminalStatus = runSignal?.aborted ? "cancelled" : "failed";
          if (terminalStatus === "failed") terminalError = extractErrorMessage(err);
        }

        await flushAllBlocks();
        if (sessionId) await endAgentSession(sessionId);
        if (turnId) await turnBus.finishTurn(turnId, terminalStatus, terminalError);

        await publish({ type: "done" });
      },
    });
