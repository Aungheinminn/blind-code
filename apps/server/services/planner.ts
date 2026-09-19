import { generateText, Output, stepCountIs, type ModelMessage } from "ai";
import { z } from "zod";
import { resolveModel } from "./providers";
import { buildReadOnlyTools, type ToolContext } from "./tools";
import type { CoderChatMessage } from "./coder";
import { buildSupabasePlannerAppendix } from "./systemAppendix";

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
  todos: z.array(planTodoSchema).min(1).max(10),
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
  signal?: AbortSignal;
};

const DEFAULT_PLANNER_PROMPT = `You are a planning agent for a coding platform that builds small React + TypeScript web apps rendered live in an in-browser Sandpack preview. Given a user's request and the current project state, produce a concise todo list the coding agent will execute.

Constraints the coder operates under:
- Fixed stack: React 19 + TS + plain CSS. Do not plan for other frameworks.
- Only source files change: App.tsx and files under src/, plus styles.css. Never plan writes to package.json, tsconfig.json, index.tsx, index.html — those are auto-generated.
- Dependencies are inferred from imports; do not plan "install X" steps.
- There is no build/test step to run; do not plan "run bun install" or "run tsc".

Your workflow:
1. Call list_files first to see what already exists in the project.
2. Read only the files directly relevant to the request — do not read the whole project.
3. Return a plan with 1-10 todos. Each todo is a single, concrete change (create/edit one file).
4. Keep todos small and independent so they can be checked off one at a time.
5. Reference existing files by path in your rationale so the coder knows what to touch.
6. You have read-only access — do not attempt to write, delete, or run anything.

Return the plan via structured output.`;

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
  const system = opts.supabaseConnected
    ? baseSystem + buildSupabasePlannerAppendix()
    : baseSystem;

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
