import { streamText, stepCountIs, tool, type ModelMessage } from "ai";
import { z } from "zod";
import { resolveModel } from "./providers";
import { runPlanner, type Plan } from "./planner";
import {
  runCoder,
  extractErrorMessage,
  type CoderChatMessage,
  type CoderEvent,
} from "./coder";
import { runVerifier, type VerifyResult } from "./verifier";
import type { ToolContext } from "./tools";

export type RouterDecision = "plan_task" | "code_task" | "answer_question" | "verify_task";

export type SubAgent = "router" | "planner" | "coder" | "verifier";

type BareRouterEvent =
  | { type: "router-decision"; tool: RouterDecision; note?: string }
  | { type: "router-answer"; text: string }
  | { type: "router-error"; error: string }
  | { type: "plan"; plan: Plan }
  | { type: "plan-error"; error: string }
  | { type: "verify-result"; result: VerifyResult }
  | { type: "verify-error"; error: string }
  | CoderEvent;

export type RouterEvent = BareRouterEvent & { subAgent: SubAgent };

const subAgentFor = (event: BareRouterEvent): SubAgent => {
  switch (event.type) {
    case "router-decision":
    case "router-answer":
    case "router-error":
      return "router";
    case "plan":
    case "plan-error":
      return "planner";
    case "verify-result":
    case "verify-error":
      return "verifier";
    default:
      return "coder";
  }
};

export type RunRouterOptions = {
  provider: string;
  model?: string;
  routerModel?: string;
  toolContext: ToolContext;
  prompt: string;
  history?: CoderChatMessage[];
  supabaseConnected?: boolean;
  supabaseCanRunSql?: boolean;
  signal?: AbortSignal;
  onEvent: (event: RouterEvent) => void;
  existingPlan?: Plan | null;
};

const emit = (
  onEvent: (event: RouterEvent) => void,
  event: BareRouterEvent,
): void => {
  onEvent({ ...event, subAgent: subAgentFor(event) } as RouterEvent);
};

const CHEAP_ROUTER_MODEL: Record<string, string> = {
  anthropic: "claude-haiku-4-5-20251001",
  openai: "gpt-4o-mini",
  google: "gemini-2.0-flash",
  groq: "llama-3.1-8b-instant",
  mistral: "mistral-small-latest",
  deepseek: "deepseek-chat",
};

const pickRouterModel = (provider: string, override?: string, coderModel?: string): string | undefined =>
  override?.trim() || CHEAP_ROUTER_MODEL[provider] || coderModel;

const ROUTER_SYSTEM_PROMPT = `You are the router for a coding assistant. On each user turn, look at the conversation and decide the next action by calling exactly one of your tools. Do not write prose to the user — communicate only through tool calls.

Tools:
- plan_task({ task }) — produce a todo list for a build/change request. Call this FIRST for any non-trivial code change when no fresh plan exists.
- code_task({ instructions, use_last_plan }) — invoke the coding sub-agent to write/edit files. Set use_last_plan=true if you just called plan_task in this turn.
- verify_task({ what_was_built }) — OPTIONAL sanity check after a substantial code_task. Skip for tiny edits.
- answer_question({ text }) — reply directly for questions that need no code changes (explanations, clarifications, small how-tos).

Rules:
- Trivial control words ("continue", "keep going", "next", "retry", "resume") → call code_task directly with the user's message as instructions and use_last_plan=false. The coder will pick up from history. Never plan for these.
- A pure question with no code intent → call answer_question.
- A build/change request → call plan_task, then in the next step call code_task with use_last_plan=true.
- After a large or multi-file code_task, you MAY call verify_task once. Skip it for single-line tweaks or trivial changes — verification isn't free.
- If verify_task reports blocking issues, you MAY call code_task once more to fix them.
- Never call plan_task twice in the same turn. Never call verify_task twice.
- Stop calling tools once the task is complete.`;

export const runRouter = async (opts: RunRouterOptions): Promise<void> => {
  const routerModelId = pickRouterModel(opts.provider, opts.routerModel, opts.model);
  const model = await resolveModel(opts.provider, routerModelId);

  let lastPlan: Plan | null = null;
  let sawTerminalError = false;
  const fallbackPlan: Plan | null = opts.existingPlan ?? null;

  const tools = {
    plan_task: tool({
      description: "Produce a todo list for a build or change request. Use before code_task.",
      inputSchema: z.object({
        task: z.string().describe("One-sentence description of the change to plan."),
      }),
      execute: async ({ task }) => {
        emit(opts.onEvent, { type: "router-decision", tool: "plan_task", note: task });
        try {
          const plan = await runPlanner({
            provider: opts.provider,
            model: opts.model,
            toolContext: opts.toolContext,
            prompt: task,
            history: opts.history,
            supabaseConnected: opts.supabaseConnected,
            signal: opts.signal,
          });
          lastPlan = plan;
          emit(opts.onEvent, { type: "plan", plan });
          return {
            summary: plan.summary,
            todos: plan.todos.map((t) => ({ id: t.id, title: t.title })),
          };
        } catch (err) {
          const error = extractErrorMessage(err);
          emit(opts.onEvent, { type: "plan-error", error });
          return { error };
        }
      },
    }),

    code_task: tool({
      description:
        "Invoke the coding sub-agent. It streams file edits and reasoning directly to the UI; you do not need to relay its output.",
      inputSchema: z.object({
        instructions: z
          .string()
          .describe("What the coder should do — usually the user's request verbatim, plus any refinements."),
        use_last_plan: z
          .boolean()
          .default(false)
          .describe("True if plan_task was just called in this turn."),
      }),
      execute: async ({ instructions, use_last_plan }) => {
        emit(opts.onEvent, { type: "router-decision", tool: "code_task" });
        const plan = use_last_plan ? lastPlan : fallbackPlan;
        try {
          await runCoder({
            provider: opts.provider,
            model: opts.model,
            toolContext: opts.toolContext,
            prompt: instructions,
            history: opts.history,
            plan,
            supabaseConnected: opts.supabaseConnected,
            supabaseCanRunSql: opts.supabaseCanRunSql,
            signal: opts.signal,
            onEvent: (event) => {
              if (event.type === "error") sawTerminalError = true;
              emit(opts.onEvent, event);
            },
          });
          return { ok: true };
        } catch (err) {
          const error = extractErrorMessage(err);
          sawTerminalError = true;
          emit(opts.onEvent, { type: "error", error });
          return { error };
        }
      },
    }),

    verify_task: tool({
      description:
        "Sanity-check the last change with a read-only reviewer. Returns { ok, issues, notes }. Use sparingly — only after substantial code_task calls.",
      inputSchema: z.object({
        what_was_built: z
          .string()
          .describe("One-sentence description of what the coder just changed, for the verifier's context."),
      }),
      execute: async ({ what_was_built }) => {
        emit(opts.onEvent, { type: "router-decision", tool: "verify_task", note: what_was_built });
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

    answer_question: tool({
      description:
        "Reply directly to the user for questions that need no code changes. The text you pass is shown to the user.",
      inputSchema: z.object({
        text: z.string().describe("The full answer to show the user."),
      }),
      execute: async ({ text }) => {
        emit(opts.onEvent, { type: "router-decision", tool: "answer_question" });
        emit(opts.onEvent, { type: "router-answer", text });
        return { ok: true };
      },
    }),
  };

  const messages: ModelMessage[] = [
    ...(opts.history ?? []).map(
      (m) => ({ role: m.role, content: m.content }) as ModelMessage,
    ),
    { role: "user", content: opts.prompt },
  ];

  try {
    const result = streamText({
      model,
      system: ROUTER_SYSTEM_PROMPT,
      messages,
      tools,
      stopWhen: stepCountIs(7),
      abortSignal: opts.signal,
    });

    // Drain the router's own stream so tool execution runs to completion.
    // Router text/reasoning is suppressed by design — it communicates only via tool calls.
    for await (const _chunk of result.fullStream) {
      // no-op; sub-agent events are already forwarded via onEvent
    }
  } catch (err) {
    if (opts.signal?.aborted) return;
    emit(opts.onEvent, { type: "router-error", error: extractErrorMessage(err) });
  }

  if (sawTerminalError) return;
};
