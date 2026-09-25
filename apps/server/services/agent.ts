import { streamText, stepCountIs, tool, type ModelMessage } from "ai";
import { z } from "zod";
import type { AgentToolPermissions } from "@vibe/shared";
import { getReasoningProviderOptions, resolveModel } from "./providers";
import { buildCoderTools, type ToolContext } from "./tools";
import { runPlanner, type Plan } from "./planner";
import { runVerifier, type VerifyResult } from "./verifier";
import {
  extractErrorMessage,
  type CoderChatMessage,
  type CoderEvent,
  type PlanTodoStatus,
} from "./coder";
import {
  buildAutoProvisionSupabaseCoderAppendix,
  buildLocalPersistenceCoderAppendix,
  buildSupabaseCoderAppendix,
} from "./systemAppendix";
import { addTodoToLatestPlan } from "../db/repo";

export type AgentDecision = "plan_task" | "verify_task";
export type SubAgent = "agent" | "planner" | "verifier";

type BareAgentEvent =
  | { type: "router-decision"; tool: AgentDecision; note?: string }
  | { type: "plan"; plan: Plan }
  | { type: "plan-error"; error: string }
  | {
      type: "plan-todo-added";
      todo: { id: string; title: string; rationale: string };
    }
  | { type: "verify-result"; result: VerifyResult }
  | { type: "verify-error"; error: string }
  | CoderEvent;

export type AgentEvent = BareAgentEvent & { subAgent: SubAgent };

const subAgentFor = (event: BareAgentEvent): SubAgent => {
  switch (event.type) {
    case "plan":
    case "plan-error":
    case "plan-todo-added":
      return "planner";
    case "verify-result":
    case "verify-error":
      return "verifier";
    default:
      return "agent";
  }
};

const emit = (
  onEvent: (event: AgentEvent) => void,
  event: BareAgentEvent,
): void => {
  onEvent({ ...event, subAgent: subAgentFor(event) } as AgentEvent);
};

export type RunAgentOptions = {
  provider: string;
  model?: string;
  toolContext: ToolContext;
  prompt: string;
  history?: CoderChatMessage[];
  existingPlan?: Plan | null;
  existingPlanStatuses?: Record<string, PlanTodoStatus>;
  supabaseConnected?: boolean;
  supabaseCanRunSql?: boolean;
  userSupabasePatConnected?: boolean;
  agentToolPermissions?: AgentToolPermissions;
  signal?: AbortSignal;
  onEvent: (event: AgentEvent) => void;
};

const AGENT_SYSTEM_PROMPT = `You are a React + TypeScript coding agent. You build small web apps end-to-end from a user's natural-language request. Your output renders live inside an in-browser Sandpack preview — there is no server dev server, no bundler config, no package install to trigger.

Stack (fixed):
- React 19 with react-dom/client createRoot.
- TypeScript with the react-jsx transform. Strict mode is on.
- Plain CSS via styles.css imports. Tailwind is not available unless the user asks for it — and even then it'll take extra plumbing.
- No routing library by default. If the user needs navigation, prefer conditional rendering unless they explicitly ask for react-router.

File layout (strict):
- App.tsx — the root component. This is your main entry point.
- Additional components/hooks/utilities go in src/ subfolders (src/components/Button.tsx, src/hooks/useX.ts, etc.).
- styles.css — global styles at the project root. Import it from index.tsx (already set up for you).
- Do NOT create: package.json, tsconfig.json, index.tsx, index.html, vite.config.*, .env, README.md, node_modules. All of these are auto-generated or unnecessary. Writing them wastes tokens and gets overwritten.

Dependencies:
- react and react-dom are always available. You never install them.
- For any other package (framer-motion, clsx, lucide-react, etc.), just import it — the platform detects imports and installs the package automatically. Do NOT ask the user to install anything.

Narration:
- Before each concrete step, call say-style narration in one short sentence (5–15 words). A step may involve several tool calls — do not re-narrate between calls within the same step.
- Only re-narrate when your intent changes (moving to a new step, or a tool result forces a re-plan).
- Keep narration terse; never restate tool arguments or dump output back to the user.

Deciding what to do:
- BUILD or CHANGE request when NO plan exists yet: call plan_task first with a one-sentence description, then work through the returned todos.
- SMALL EXTENSION while a plan is UNFINISHED (user asks for something that naturally fits current scope — "also add X to the list", "handle the empty state too", "put a reject button on each row"): call add_todo to append a single new todo, then do the work. Do NOT call plan_task — that would regenerate the whole plan unnecessarily.
- LARGER NEW WORK or a shift in direction while a plan is UNFINISHED ("now let's add auth", "redesign the whole app"): call plan_task. Carry-forward will preserve any unfinished todos from the current plan.
- ANY build/change request when the current plan is COMPLETE (every todo [done] or [skipped]): call plan_task for a fresh scope. Do NOT call add_todo — the existing plan is closed and add_todo will be rejected. Complete plans do not accept extensions.
- CONTINUE or RESUME request ("continue", "keep going", "go on", "proceed", "next", "sry my bad continue", any synonym or filler variant) while a plan is UNFINISHED: do NOT call plan_task or add_todo. Read the plan in your system context, find the first unfinished todo, resume.
- CONTINUE request when the current plan is COMPLETE, OR when NO plan exists: do NOT call any tool. Respond briefly that there is nothing in progress and ask the user what they want to build or change next.
- MIXED continue + new work ("continue and also add X", "keep going but also do Y", "go on, plus add Z"): recognize the mixed intent. If the plan is unfinished, call add_todo FIRST to track the new item (so it appears in the plan tray immediately), THEN resume as normal. If the plan is complete, ignore the "continue" — treat it as a fresh build request and call plan_task. Do NOT silently bundle the new work into an existing todo.
- PURE QUESTION with no code intent ("what does src/App.tsx do?", "does anything look broken?"): read the relevant files, respond in text, do not modify anything. You may call verify_task if the user explicitly asks for a review.
- After a substantial multi-file change, you MAY call verify_task once to sanity-check. Skip it for single-line tweaks — verification isn't free.
- If verify_task reports blocking issues, fix them, then stop.

Workflow:
1. Call list_files first to see what already exists.
2. Read any file you're about to modify — do not guess at existing content.
3. Write only source files (App.tsx and files under src/, plus styles.css). Prefer editing existing files over creating parallel new ones.
4. Do NOT call run_command. There is no build to run and no dev server to start — the preview compiles your source in the browser. If you think you need run_command, you don't.
5. Keep components small and focused. Split a large component into src/components/*.
6. When finished, respond with a one-sentence summary of what the user can now do.

Tools:
- list_files, read_file, write_file, delete_file — file operations
- update_todo — mark plan todos active/done/skipped
- plan_task — produce (or replace) the todo list. Never call twice per turn. Use for genuinely new/larger work.
- add_todo — append ONE new todo to the current plan (cheaper than plan_task; use when the user asks for a small extension mid-work that fits current plan scope)
- verify_task — sanity-check the last change (call at most once per turn)
Do not use run_command.`;

const isPlanComplete = (
  plan: Plan,
  statuses?: Record<string, PlanTodoStatus>,
): boolean => {
  if (!plan.todos.length) return false;
  return plan.todos.every((t) => {
    const s = statuses?.[t.id] ?? "pending";
    return s === "done" || s === "skipped";
  });
};

const buildPlanAppendix = (
  plan: Plan,
  statuses?: Record<string, PlanTodoStatus>,
): string => {
  const list = plan.todos
    .map((t) => {
      const status = statuses?.[t.id] ?? "pending";
      const rationale = t.rationale ? ` — ${t.rationale}` : "";
      return `- [${status}] ${t.id}: ${t.title}${rationale}`;
    })
    .join("\n");
  const complete = isPlanComplete(plan, statuses);
  const banner = complete
    ? "\n\n>>> PLAN COMPLETE — every todo is [done] or [skipped]. This plan is closed. Any new build/change request must call plan_task for a fresh plan; add_todo will be rejected. A bare 'continue' should be answered in text — there is nothing in progress. <<<"
    : "";
  const carryForwardNote =
    !complete &&
    statuses &&
    Object.values(statuses).some((s) => s === "done" || s === "skipped")
      ? "\n\nSome todos are already [done] or [skipped] from prior turns — do NOT re-execute them. Start from the first [pending] or [active] todo."
      : "";
  return `\n\nA plan is active for this project.${banner}\n\nSummary: ${plan.summary}\n\nTodos:\n${list}${carryForwardNote}\n\nProtocol:\n- Follow the todos in order unless there's a good reason not to.\n- Before starting a todo, call update_todo({ id, status: "active" }).\n- As soon as a todo is complete, call update_todo({ id, status: "done" }).\n- If a todo turns out to be unnecessary, call update_todo({ id, status: "skipped", note: "..." }).\n- Do not fabricate ids — use the exact ids from the list above.`;
};

export const runAgent = async (opts: RunAgentOptions): Promise<void> => {
  const model = await resolveModel(opts.provider, opts.model);
  const reasoning = getReasoningProviderOptions(opts.provider, opts.model);

  // Leaf tools from tools.ts — file/DB/HTTP operations that only need ToolContext.
  // They stand alone: no sub-agent LLM calls, no access to runAgent's closure
  // (provider/model/history/onEvent). Add new tools here if they're pure I/O.
  const baseTools = buildCoderTools(opts.toolContext, opts.agentToolPermissions);

  const tools = {
    ...baseTools,
    // Below: tools that live inline in runAgent (NOT in tools.ts) because they
    // need runAgent's closure — either to spawn sub-agent LLMs (plan_task,
    // verify_task hand off to the planner/verifier with this run's provider,
    // model, history, abort signal), or to emit control-flow events into
    // opts.onEvent so the client's plan-tray UI updates in real time
    // (plan-todo-added, plan, verify-result, router-decision).
    plan_task: tool({
      description:
        "Produce a todo list for a new build or change request. Call this FIRST for any non-trivial code change. If an incomplete plan already exists for the project, its unfinished todos are automatically carried into the new plan — the planner merges them. Never call twice per turn.",
      inputSchema: z.object({
        task: z.string().describe("One-sentence description of the change to plan."),
      }),
      execute: async ({ task }) => {
        emit(opts.onEvent, { type: "router-decision", tool: "plan_task", note: task });
        try {
          const existingUnfinished =
            opts.existingPlan && opts.existingPlanStatuses
              ? {
                  summary: opts.existingPlan.summary,
                  todos: opts.existingPlan.todos.filter((t) => {
                    const s = opts.existingPlanStatuses?.[t.id] ?? "pending";
                    return s === "pending" || s === "active";
                  }),
                }
              : null;
          const plan = await runPlanner({
            provider: opts.provider,
            model: opts.model,
            toolContext: opts.toolContext,
            prompt: task,
            history: opts.history,
            supabaseConnected: opts.supabaseConnected,
            userSupabasePatConnected: opts.userSupabasePatConnected,
            signal: opts.signal,
            existingUnfinished,
          });
          emit(opts.onEvent, { type: "plan", plan });
          return {
            summary: plan.summary,
            todos: plan.todos.map((t) => ({
              id: t.id,
              title: t.title,
              rationale: t.rationale,
            })),
          };
        } catch (err) {
          const error = extractErrorMessage(err);
          emit(opts.onEvent, { type: "plan-error", error });
          return { error };
        }
      },
    }),

    add_todo: tool({
      description:
        "Append ONE new todo to the current plan without regenerating the whole plan. Use for small mid-work extensions that fit the current plan's scope (e.g. user asks 'also add X to the list' while you're already working on that list). Requires an existing plan; returns { error } if none. Cheaper than plan_task — no planner LLM call.",
      inputSchema: z.object({
        title: z
          .string()
          .describe("Single concrete action, e.g. 'Add reject button to TodoList row'."),
        rationale: z
          .string()
          .optional()
          .describe("One-line reason this todo is needed."),
      }),
      execute: async ({ title, rationale }) => {
        if (!opts.toolContext.dbProjectId) {
          return { error: "no project — cannot add todo" };
        }
        if (
          opts.existingPlan &&
          isPlanComplete(opts.existingPlan, opts.existingPlanStatuses)
        ) {
          return {
            error:
              "current plan is complete — call plan_task to start a fresh plan for the new work",
          };
        }
        try {
          const added = await addTodoToLatestPlan(opts.toolContext.dbProjectId, {
            title,
            rationale,
          });
          if (!added) {
            return { error: "no active plan to append to — call plan_task first" };
          }
          emit(opts.onEvent, { type: "plan-todo-added", todo: added });
          return { added };
        } catch (err) {
          return { error: extractErrorMessage(err) };
        }
      },
    }),

    verify_task: tool({
      description:
        "Sanity-check the last change with a read-only reviewer. Returns { ok, issues, notes }. Use sparingly — only after substantial changes. Call at most once per turn.",
      inputSchema: z.object({
        what_was_built: z
          .string()
          .describe("One-sentence description of what you just changed, for the verifier's context."),
      }),
      execute: async ({ what_was_built }) => {
        emit(opts.onEvent, {
          type: "router-decision",
          tool: "verify_task",
          note: what_was_built,
        });
        try {
          const result = await runVerifier({
            provider: opts.provider,
            model: opts.model,
            toolContext: opts.toolContext,
            whatWasBuilt: what_was_built,
            signal: opts.signal,
          });
          emit(opts.onEvent, { type: "verify-result", result });
          return { ok: result.ok, issues: result.issues, notes: result.notes ?? null };
        } catch (err) {
          const error = extractErrorMessage(err);
          emit(opts.onEvent, { type: "verify-error", error });
          return { error };
        }
      },
    }),
  };

  const messages: ModelMessage[] = [
    ...(opts.history ?? []).map(
      (m) => ({ role: m.role, content: m.content }) as ModelMessage,
    ),
    { role: "user", content: opts.prompt },
  ];

  const withPlan = opts.existingPlan
    ? AGENT_SYSTEM_PROMPT + buildPlanAppendix(opts.existingPlan, opts.existingPlanStatuses)
    : AGENT_SYSTEM_PROMPT;
  const system = opts.supabaseConnected
    ? withPlan + buildSupabaseCoderAppendix({ canRunSql: Boolean(opts.supabaseCanRunSql) })
    : opts.userSupabasePatConnected
      ? withPlan + buildAutoProvisionSupabaseCoderAppendix()
      : withPlan + buildLocalPersistenceCoderAppendix();

  const todoCount = opts.existingPlan?.todos.length ?? 0;
  const stepCap = Math.max(40, todoCount * 6 + 20);

  try {
    const result = streamText({
      model,
      system,
      messages,
      tools,
      stopWhen: stepCountIs(stepCap),
      abortSignal: opts.signal,
      ...(reasoning.providerOptions ? { providerOptions: reasoning.providerOptions } : {}),
      ...(reasoning.maxOutputTokens ? { maxOutputTokens: reasoning.maxOutputTokens } : {}),
    });

    for await (const chunk of result.fullStream) {
      switch (chunk.type) {
        case "text-start" as any:
          emit(opts.onEvent, { type: "text-start", id: (chunk as any).id });
          break;
        case "text-delta":
          emit(opts.onEvent, {
            type: "text-delta",
            id: (chunk as any).id,
            text: (chunk as any).text ?? (chunk as any).delta ?? "",
          });
          break;
        case "text-end" as any:
          emit(opts.onEvent, { type: "text-end", id: (chunk as any).id });
          break;
        case "reasoning-start" as any:
        case "reasoning-delta" as any:
        case "reasoning-end" as any:
          break;
        case "tool-call":
          emit(opts.onEvent, {
            type: "tool-call",
            toolCallId: (chunk as any).toolCallId,
            toolName: (chunk as any).toolName,
            input: (chunk as any).input ?? (chunk as any).args,
          });
          break;
        case "tool-result":
          emit(opts.onEvent, {
            type: "tool-result",
            toolCallId: (chunk as any).toolCallId,
            toolName: (chunk as any).toolName,
            output: (chunk as any).output ?? (chunk as any).result,
          });
          break;
        case "finish-step":
        case "step-finish" as any:
          emit(opts.onEvent, {
            type: "step-finish",
            finishReason: (chunk as any).finishReason ?? "unknown",
          });
          break;
        case "finish":
          emit(opts.onEvent, {
            type: "finish",
            finishReason: (chunk as any).finishReason ?? "unknown",
            usage: (chunk as any).usage,
          });
          break;
        case "error":
          emit(opts.onEvent, {
            type: "error",
            error: extractErrorMessage((chunk as any).error),
          });
          break;
      }
    }
  } catch (err) {
    if (opts.signal?.aborted) return;
    emit(opts.onEvent, { type: "error", error: extractErrorMessage(err) });
  }
};
