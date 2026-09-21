import { generateText, Output, stepCountIs, type ModelMessage } from "ai";
import { z } from "zod";
import { resolveModel } from "./providers";
import { buildReadOnlyTools, type ToolContext } from "./tools";

export const verifyResultSchema = z.object({
  ok: z.boolean().describe("True if the change looks correct with no blocking issues."),
  issues: z
    .array(z.string())
    .describe("Short, specific issues found — missing imports, unfinished TODOs, obvious bugs, etc."),
  notes: z
    .string()
    .optional()
    .describe("Optional one-line summary of what was checked."),
});

export type VerifyResult = z.infer<typeof verifyResultSchema>;

export type RunVerifierOptions = {
  provider: string;
  model?: string;
  toolContext: ToolContext;
  whatWasBuilt: string;
  signal?: AbortSignal;
};

const VERIFIER_SYSTEM_PROMPT = `You are a fast code reviewer for a React + TypeScript project rendered in an in-browser Sandpack preview. You just ran after a coding sub-agent finished a change. Your job is a sanity check, not a full audit.

Workflow:
1. Call list_files to see what exists.
2. Read ONLY the files most relevant to the described change (usually 1–3 files). Do not read the whole project.
3. Return a verdict with structured output.

What counts as an issue (report these):
- Missing/wrong imports that would fail at runtime.
- Referenced components/hooks/functions that aren't defined or exported.
- Empty file, TODO left in code that the user asked to complete, obvious typos in JSX.
- Files that were supposed to exist per the task description but don't.

What does NOT count as an issue (do not report these):
- Style/formatting preferences.
- "Could be refactored" suggestions.
- Missing tests (there is no test setup).
- Missing package.json / tsconfig / index.tsx entries (those are auto-generated).

Be terse. Each issue should be one line, actionable, and reference a file path.`;

export const runVerifier = async (opts: RunVerifierOptions): Promise<VerifyResult> => {
  const model = await resolveModel(opts.provider, opts.model);
  const tools = buildReadOnlyTools(opts.toolContext);

  const messages: ModelMessage[] = [
    {
      role: "user",
      content: `Verify this change: ${opts.whatWasBuilt}`,
    },
  ];

  const result = await generateText({
    model,
    system: VERIFIER_SYSTEM_PROMPT,
    messages,
    tools,
    stopWhen: stepCountIs(6),
    experimental_output: Output.object({ schema: verifyResultSchema }),
    abortSignal: opts.signal,
  });

  return result.experimental_output;
};
