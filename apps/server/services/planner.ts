import { generateText, Output, stepCountIs, type ModelMessage } from "ai";
import { z } from "zod";
import { resolveModel } from "./providers";
import { buildReadOnlyTools, type ToolContext } from "./tools";
import type { CoderChatMessage } from "./coder";
import {
  buildAutoProvisionSupabasePlannerAppendix,
  buildLocalPersistencePlannerAppendix,
  buildSupabasePlannerAppendix,
} from "./systemAppendix";

export const planTodoSchema = z.object({
  id: z.string().describe("Short stable id, e.g. 't1', 't2'."),
  title: z
    .string()
    .describe("Single concrete action the coder will perform, e.g. 'Create src/theme.tsx with ThemeContext'."),
  rationale: z
    .string()
    .describe("One-line reason this step is needed, referencing existing files where relevant."),
});

export const planSchema = z.object({
  summary: z.string().describe("One-sentence description of what will be built or changed."),
  todos: z.array(planTodoSchema).min(1),
});

export type PlanTodo = z.infer<typeof planTodoSchema>;
export type Plan = z.infer<typeof planSchema>;

export type RunPlannerOptions = {
  provider: string;
  model?: string;
  toolContext: ToolContext;
  prompt: string;
  history?: CoderChatMessage[];
  maxSteps?: number;
  systemPrompt?: string;
  supabaseConnected?: boolean;
  userSupabasePatConnected?: boolean;
  signal?: AbortSignal;
  existingUnfinished?: Plan | null;
};

const DEFAULT_PLANNER_PROMPT = `You are a planning agent for a coding platform that builds small React + TypeScript web apps rendered live in an in-browser Sandpack preview. Given a user's request and the current project state, produce a concise todo list the coding agent will execute.

Constraints the coder operates under:
- Fixed stack: React 19 + TS + Tailwind CSS v3 + shadcn/ui primitives (Button, Card, Input, Label available under src/components/ui/). Do not plan for other frameworks or non-Tailwind styling.
- Only source files change: everything under src/. Never plan writes to package.json, tsconfig.json, vite.config.ts, postcss.config.js, tailwind.config.js, index.html, src/main.tsx, src/index.css, src/lib/utils.ts, or src/components/ui/* — those are auto-generated or already provided.
- Prefer composing from shadcn primitives over raw <button>/<input>/etc. When a plan step creates UI, mention which primitive(s) it should use.
- Dependencies are inferred from imports; do not plan "install X" steps.
- There is no build/test step to run; do not plan "run bun install" or "run tsc".

Your workflow:
1. Call list_files first to see what already exists in the project.
2. Read only the files directly relevant to the request — do not read the whole project.
3. Return a plan whose length matches the request's actual scope. Each todo is a single, concrete change (create/edit one file, or one tight logical step).
4. Keep todos small and independent so they can be checked off one at a time.
5. Reference existing files by path in your rationale so the coder knows what to touch.
6. You have read-only access — do not attempt to write, delete, or run anything.

Right-sizing the plan (this matters — do not pad, do not squash):
- Trivial tweak (rename a variable, change a color): 1 todo.
- Small self-contained app ("build a calculator", "build a timer", "build a todo list"): 3-5 todos usually. Not 8, not 2.
- Medium feature on an existing app (add auth, add filters, add a settings page): 4-7 todos.
- Large multi-surface change (redesign whole app, add multi-page routing): whatever it takes — commonly 8-12. Never pad to look thorough.
- If the request is genuinely simple, DO NOT invent extra todos to look thorough.
- If the request is genuinely large, DO NOT collapse everything into 2 mega-todos that the coder can't act on cleanly.

Return the plan via structured output.`;

const buildCarryForwardAppendix = (unfinished: Plan): string => {
  const list = unfinished.todos
    .map((t) => `- ${t.title}${t.rationale ? ` — ${t.rationale}` : ""}`)
    .join("\n");
  return `\n\nCARRY-FORWARD CONTEXT:\nThe user has an existing plan with unfinished work. Your new plan MUST include the following unfinished todos alongside anything new the user asked for. Preserve their intent — rephrase only if you need to consolidate with genuinely related new work:\n${list}\n\nOrdering: place carried-over unfinished todos FIRST in the new plan, then the new work. Merged todos (where old and new work touch the same file) can go wherever fits the flow best.\n\nMerging rules:\n- Do NOT collapse multiple unfinished todos into one to shorten the list. Each carried-over todo represents concrete work the user has already invested in — losing granularity means losing trackability.\n- Only merge an unfinished todo with a new one when they touch the same file AND the new work naturally supersedes or extends the unfinished intent.\n- If the combined plan gets long, that is fine. Length should reflect actual scope, not an arbitrary ceiling.\n\nDo not repeat todos that are already implicit in the unfinished list. The user is extending, not replacing.`;
};

export const runPlanner = async (opts: RunPlannerOptions): Promise<Plan> => {
  const model = await resolveModel(opts.provider, opts.model);
  const tools = buildReadOnlyTools(opts.toolContext);

  const messages: ModelMessage[] = [
    ...(opts.history ?? []).map(
      (m) => ({ role: m.role, content: m.content }) as ModelMessage,
    ),
    { role: "user", content: opts.prompt },
  ];

  const baseSystem = opts.systemPrompt ?? DEFAULT_PLANNER_PROMPT;
  const withCarry =
    opts.existingUnfinished && opts.existingUnfinished.todos.length > 0
      ? baseSystem + buildCarryForwardAppendix(opts.existingUnfinished)
      : baseSystem;
  const system = opts.supabaseConnected
    ? withCarry + buildSupabasePlannerAppendix()
    : opts.userSupabasePatConnected
      ? withCarry + buildAutoProvisionSupabasePlannerAppendix()
      : withCarry + buildLocalPersistencePlannerAppendix();

  const result = await generateText({
    model,
    system,
    messages,
    tools,
    stopWhen: stepCountIs(opts.maxSteps ?? 10),
    experimental_output: Output.object({ schema: planSchema }),
    abortSignal: opts.signal,
  });

  return result.experimental_output;
};
