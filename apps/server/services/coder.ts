import { streamText, stepCountIs, type ModelMessage } from "ai";
import { getReasoningProviderOptions, resolveModel } from "./providers";
import { buildCoderTools, type ToolContext } from "./tools";
import type { Plan } from "./planner";
import type { PlanTodoStatus as SharedPlanTodoStatus } from "@vibe/shared";
import {
  buildLocalPersistenceCoderAppendix,
  buildSupabaseCoderAppendix,
} from "./systemAppendix";

export type CoderEvent =
  | { type: "text-start"; id: string }
  | { type: "text-delta"; id: string; text: string }
  | { type: "text-end"; id: string }
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

export type PlanTodoStatus = SharedPlanTodoStatus;

export type RunCoderOptions = {
  provider: string;
  model?: string;
  toolContext: ToolContext;
  prompt: string;
  history?: CoderChatMessage[];
  maxSteps?: number;
  systemPrompt?: string;
  plan?: Plan | null;
  todoStatuses?: Record<string, PlanTodoStatus>;
  supabaseConnected?: boolean;
  supabaseCanRunSql?: boolean;
  onEvent: (event: CoderEvent) => void;
  signal?: AbortSignal;
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
  const carryForwardNote =
    statuses && Object.values(statuses).some((s) => s === "done" || s === "skipped")
      ? "\n\nSome todos are already [done] or [skipped] from prior turns — do NOT re-execute them. Start from the first [pending] or [active] todo."
      : "";
  return `\n\nA plan is active for this project.\n\nSummary: ${plan.summary}\n\nTodos:\n${list}${carryForwardNote}\n\nProtocol:\n- Follow the todos in order unless there's a good reason not to.\n- Before starting a todo, call update_todo({ id, status: "active" }).\n- As soon as a todo is complete, call update_todo({ id, status: "done" }).\n- If a todo turns out to be unnecessary, call update_todo({ id, status: "skipped", note: "..." }).\n- Do not fabricate ids — use the exact ids from the list above.`;
};

const DEFAULT_SYSTEM_PROMPT = `You are a React + TypeScript coding agent. You build small web apps end-to-end from a user's natural-language request. Your output renders live inside an in-browser Sandpack preview — there is no server dev server, no bundler config, no package install to trigger.

Stack (fixed):
- React 19 with react-dom/client createRoot.
- TypeScript with the react-jsx transform. Strict mode is on.
- Tailwind CSS v3 (via PostCSS + autoprefixer). All styling is Tailwind utility classes on JSX elements. No plain CSS files beyond the shared src/index.css, no CSS modules, no styled-components.
- shadcn/ui primitives are pre-installed under src/components/ui/. Available now: Button, Card (with CardHeader/CardTitle/CardDescription/CardContent/CardFooter), Input, Label. Import from "@/components/ui/<name>". Compose from these primitives instead of writing raw <button>/<input> whenever a primitive fits.
- The cn() class-name helper is at src/lib/utils.ts. Import from "@/lib/utils".
- No routing library by default. If the user needs navigation, prefer conditional rendering unless they explicitly ask for react-router.

File layout (strict):
- src/App.tsx — the root component. This is your main entry point.
- Additional components/hooks/utilities go in src/ subfolders (src/components/Header.tsx, src/hooks/useNow.ts, etc.).
- All source files live under src/. Do not write files outside src/.
- Do NOT create or modify: package.json, tsconfig.json, vite.config.ts, postcss.config.js, tailwind.config.js, index.html, src/main.tsx, src/index.css, src/lib/utils.ts, src/components/ui/*, .env, README.md, node_modules. Those are auto-generated or already provided. Writing them wastes tokens and gets overwritten.

Dependencies:
- react, react-dom, tailwindcss, clsx, tailwind-merge, class-variance-authority, @radix-ui/react-slot, @radix-ui/react-label are always available. You never install them.
- For any other package (framer-motion, lucide-react, date-fns, zustand, recharts, etc.), just import it — the platform detects imports and installs the package automatically. Do NOT ask the user to install anything.

Design token discipline (strict):
- Never write raw hex (#RRGGBB), rgb(), hsl(), or oklch() in JSX or CSS. Colors must come through Tailwind classes bound to CSS variables: bg-background, bg-card, bg-primary, bg-secondary, bg-muted, bg-accent, bg-destructive, text-foreground, text-muted-foreground, text-primary-foreground, border-border, border-input, ring-ring, and their variants.
- Never use arbitrary Tailwind values with brackets (p-[13px], text-[15px], text-[#abc], rounded-[7px], w-[240px]). Use the token scale: p-1..p-16, gap-1..gap-8, text-xs..text-3xl, rounded-sm/md/lg/full.
- Compose from shadcn primitives whenever a primitive fits. <Button variant="..."> instead of raw <button>. <Card>/<CardHeader>/<CardTitle>/<CardDescription>/<CardContent>/<CardFooter> instead of hand-rolled panels. <Input> instead of raw <input>. <Label> instead of raw <label>.
- Icons: import from lucide-react (import { ChevronRight } from "lucide-react") — do not inline SVG for standard icons.

Narration:
- Before each concrete step, call say-style narration in one short sentence (5–15 words). A step may involve several tool calls — do not re-narrate between calls within the same step.
- Only re-narrate when your intent changes (moving to a new step, or a tool result forces a re-plan).
- Keep narration terse; never restate tool arguments or dump output back to the user.

Workflow:
1. Call list_files first to see what already exists.
2. Read any file you're about to modify — do not guess at existing content.
3. Write only files under src/. Prefer editing existing files over creating parallel new ones. When a shadcn primitive fits (Button, Card, Input, Label), use it instead of raw HTML elements.
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
  const withPlan = opts.plan
    ? baseSystem + buildPlanAppendix(opts.plan, opts.todoStatuses)
    : baseSystem;
  const system = opts.supabaseConnected
    ? withPlan + buildSupabaseCoderAppendix({ canRunSql: Boolean(opts.supabaseCanRunSql) })
    : withPlan + buildLocalPersistenceCoderAppendix();

  // Each todo consumes ~6 model steps end-to-end, so a flat cap starves plans of 7+ todos.
  const derivedMax = Math.max(30, (opts.plan?.todos.length ?? 0) * 6 + 10);

  try {
    const result = streamText({
      model,
      system,
      messages,
      tools,
      stopWhen: stepCountIs(opts.maxSteps ?? derivedMax),
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
        case "reasoning-delta" as any:
        case "reasoning-end" as any:
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
