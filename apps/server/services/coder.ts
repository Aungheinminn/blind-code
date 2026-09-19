import { streamText, stepCountIs, type ModelMessage } from "ai";
import { getReasoningProviderOptions, resolveModel } from "./providers";
import { buildCoderTools, type ToolContext } from "./tools";
import type { Plan } from "./planner";
import { buildSupabaseCoderAppendix } from "./systemAppendix";

export type CoderEvent =
  | { type: "text-start"; id: string }
  | { type: "text-delta"; id: string; text: string }
  | { type: "text-end"; id: string }
  | { type: "reasoning-start"; id: string }
  | { type: "reasoning-delta"; id: string; text: string }
  | { type: "reasoning-end"; id: string }
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
  supabaseConnected?: boolean;
  supabaseCanRunSql?: boolean;
  onEvent: (event: CoderEvent) => void;
  signal?: AbortSignal;
};

const buildPlanAppendix = (plan: Plan): string => {
  const list = plan.todos
    .map((t) => `- ${t.id}: ${t.title}${t.rationale ? ` — ${t.rationale}` : ""}`)
    .join("\n");
  return `\n\nA plan has been produced for this turn.\n\nSummary: ${plan.summary}\n\nTodos:\n${list}\n\nProtocol:\n- Follow the todos in order unless there's a good reason not to.\n- Before starting a todo, call update_todo({ id, status: "active" }).\n- As soon as a todo is complete, call update_todo({ id, status: "done" }).\n- If a todo turns out to be unnecessary, call update_todo({ id, status: "skipped", note: "..." }).\n- Do not fabricate ids — use the exact ids from the list above.`;
};

const DEFAULT_SYSTEM_PROMPT = `You are a React + TypeScript coding agent. You build small web apps end-to-end from a user's natural-language request. Your output renders live inside an in-browser Sandpack preview — there is no server dev server, no bundler config, no package install to trigger.

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

Workflow:
1. Call list_files first to see what already exists.
2. Read any file you're about to modify — do not guess at existing content.
3. Write only source files (App.tsx and files under src/, plus styles.css). Prefer editing existing files over creating parallel new ones.
4. Do NOT call run_command. There is no build to run and no dev server to start — the preview compiles your source in the browser. If you think you need run_command, you don't.
5. Keep components small and focused. Split a large component into src/components/*.
6. When finished, respond with a one-sentence summary of what the user can now do.

Tools available: list_files, read_file, write_file, delete_file, update_todo. Do not use run_command.`;

export const runCoder = async (opts: RunCoderOptions): Promise<void> => {
  const model = await resolveModel(opts.provider, opts.model);
  const tools = buildCoderTools(opts.toolContext);
  const reasoning = getReasoningProviderOptions(opts.provider, opts.model);

  const messages: ModelMessage[] = [
    ...(opts.history ?? []).map(
      (m) => ({ role: m.role, content: m.content }) as ModelMessage,
    ),
    { role: "user", content: opts.prompt },
  ];

  const baseSystem = opts.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
  const withPlan = opts.plan ? baseSystem + buildPlanAppendix(opts.plan) : baseSystem;
  const system = opts.supabaseConnected
    ? withPlan + buildSupabaseCoderAppendix({ canRunSql: Boolean(opts.supabaseCanRunSql) })
    : withPlan;

  try {
    const result = streamText({
      model,
      system,
      messages,
      tools,
      stopWhen: stepCountIs(opts.maxSteps ?? 20),
      abortSignal: opts.signal,
      ...(reasoning.providerOptions ? { providerOptions: reasoning.providerOptions } : {}),
      ...(reasoning.maxOutputTokens ? { maxOutputTokens: reasoning.maxOutputTokens } : {}),
    });

    for await (const chunk of result.fullStream) {
      switch (chunk.type) {
        case "text-start" as any:
          opts.onEvent({ type: "text-start", id: (chunk as any).id });
          break;
        case "text-delta":
          opts.onEvent({
            type: "text-delta",
            id: (chunk as any).id,
            text: (chunk as any).text ?? (chunk as any).delta ?? "",
          });
          break;
        case "text-end" as any:
          opts.onEvent({ type: "text-end", id: (chunk as any).id });
          break;
        case "reasoning-start" as any:
          opts.onEvent({ type: "reasoning-start", id: (chunk as any).id });
          break;
        case "reasoning-delta" as any: {
          const text = (chunk as any).delta ?? (chunk as any).text ?? "";
          if (text)
            opts.onEvent({ type: "reasoning-delta", id: (chunk as any).id, text });
          break;
        }
        case "reasoning-end" as any:
          opts.onEvent({ type: "reasoning-end", id: (chunk as any).id });
          break;
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
