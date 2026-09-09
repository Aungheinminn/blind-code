import { streamText, stepCountIs, type ModelMessage } from "ai";
import { resolveModel } from "./providers";
import { buildCoderTools, type ToolContext } from "./tools";
import type { Plan } from "./planner";

export type CoderEvent =
  | { type: "text-delta"; text: string }
  | { type: "reasoning-delta"; text: string }
  | { type: "tool-call"; toolCallId: string; toolName: string; input: unknown }
  | { type: "tool-result"; toolCallId: string; toolName: string; output: unknown }
  | { type: "step-finish"; finishReason: string }
  | { type: "finish"; finishReason: string; usage?: unknown }
  | { type: "error"; error: string };

export type CoderChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export const extractErrorMessage = (v: unknown): string => {
  if (v == null) return "unknown error";
  if (typeof v === "string") return v;
  if (v instanceof Error) return v.message;
  if (typeof v === "object") {
    const msg = (v as { message?: unknown }).message;
    if (typeof msg === "string") return msg;
    try {
      return JSON.stringify(v);
    } catch {
      return "unknown error";
    }
  }
  return String(v);
};

export type RunCoderOptions = {
  provider: string;
  model?: string;
  toolContext: ToolContext;
  prompt: string;
  history?: CoderChatMessage[];
  maxSteps?: number;
  systemPrompt?: string;
  plan?: Plan | null;
  onEvent: (event: CoderEvent) => void;
  signal?: AbortSignal;
};

const buildPlanAppendix = (plan: Plan): string => {
  const list = plan.todos
    .map((t) => `- ${t.id}: ${t.title}${t.rationale ? ` — ${t.rationale}` : ""}`)
    .join("\n");
  return `\n\nA plan has been produced for this turn.\n\nSummary: ${plan.summary}\n\nTodos:\n${list}\n\nProtocol:\n- Follow the todos in order unless there's a good reason not to.\n- Before starting a todo, call update_todo({ id, status: "active" }).\n- As soon as a todo is complete, call update_todo({ id, status: "done" }).\n- If a todo turns out to be unnecessary, call update_todo({ id, status: "skipped", note: "..." }).\n- Do not fabricate ids — use the exact ids from the list above.`;
};

const DEFAULT_SYSTEM_PROMPT = `You are a coding agent working inside a sandboxed project directory. You build small web apps (React, Svelte, static sites, Node scripts) end-to-end from a user's natural-language request.

Your workflow:
1. Call list_files first to see what already exists.
2. Read any relevant files before modifying them.
3. Write all files needed for a runnable project (package.json, entry point, HTML/config, source files).
4. When installing deps or running builds, use run_command with ['bun', 'install'] or similar. Never start long-running dev servers with run_command — the platform manages those.
5. Keep changes minimal and focused on the user's request.
6. Before you claim to be done, verify your work:
   - If the project has a package.json with a "build" script, run ['bun', 'run', 'build'] and fix any errors.
   - If it's a TypeScript project, run ['bunx', 'tsc', '--noEmit'] and fix any type errors.
   - If it's a plain static site, at least confirm the entry file (index.html or similar) exists and imports resolve.
   - Iterate on failures — don't hand off a broken build.
7. When you're done, respond with a short summary of what you built and how to run it.

Tools available: list_files, read_file, write_file, delete_file, run_command, update_todo. Always prefer editing existing files over creating parallel new ones.`;

export const runCoder = async (opts: RunCoderOptions): Promise<void> => {
  const model = await resolveModel(opts.provider, opts.model);
  const tools = buildCoderTools(opts.toolContext);

  const messages: ModelMessage[] = [
    ...(opts.history ?? []).map(
      (m) => ({ role: m.role, content: m.content }) as ModelMessage,
    ),
    { role: "user", content: opts.prompt },
  ];

  const baseSystem = opts.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
  const system = opts.plan ? baseSystem + buildPlanAppendix(opts.plan) : baseSystem;

  try {
    const result = streamText({
      model,
      system,
      messages,
      tools,
      stopWhen: stepCountIs(opts.maxSteps ?? 20),
      abortSignal: opts.signal,
    });

    for await (const chunk of result.fullStream) {
      switch (chunk.type) {
        case "text-delta":
          opts.onEvent({ type: "text-delta", text: (chunk as any).text ?? "" });
          break;
        case "reasoning-delta" as any: {
          const text = (chunk as any).delta ?? (chunk as any).text ?? "";
          if (text) opts.onEvent({ type: "reasoning-delta", text });
          break;
        }
        case "tool-call":
          opts.onEvent({
            type: "tool-call",
            toolCallId: (chunk as any).toolCallId,
            toolName: (chunk as any).toolName,
            input: (chunk as any).input ?? (chunk as any).args,
          });
          break;
        case "tool-result":
          opts.onEvent({
            type: "tool-result",
            toolCallId: (chunk as any).toolCallId,
            toolName: (chunk as any).toolName,
            output: (chunk as any).output ?? (chunk as any).result,
          });
          break;
        case "finish-step":
        case "step-finish" as any:
          opts.onEvent({
            type: "step-finish",
            finishReason: (chunk as any).finishReason ?? "unknown",
          });
          break;
        case "finish":
          opts.onEvent({
            type: "finish",
            finishReason: (chunk as any).finishReason ?? "unknown",
            usage: (chunk as any).usage,
          });
          break;
        case "error":
          opts.onEvent({
            type: "error",
            error: extractErrorMessage((chunk as any).error),
          });
          break;
      }
    }
  } catch (err) {
    opts.onEvent({ type: "error", error: extractErrorMessage(err) });
  }
};
