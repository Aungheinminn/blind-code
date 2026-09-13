import { generateText, Output } from "ai";
import { z } from "zod";
import { resolveModel } from "./providers";

export const titleSchema = z.object({
  title: z
    .string()
    .min(1)
    .max(60)
    .describe("Short project name, 2-5 words, no punctuation, no quotes."),
  description: z
    .string()
    .min(1)
    .max(200)
    .describe("One-sentence summary of what the app does."),
});

export type ProjectTitle = z.infer<typeof titleSchema>;

const SYSTEM = `You name coding projects. Given a user's request, return a concise project title and a one-sentence description.

Rules:
- Title: 2-5 words, Title Case, no quotes, no trailing punctuation, no emojis. Prefer something a developer would name their repo.
- Description: one sentence, plain text, under 200 characters, present tense, describes what the app does.
- Do not repeat the user's prompt verbatim.
- Return the result via structured output.`;

const heuristicFallback = (prompt: string): ProjectTitle => {
  const cleaned = prompt.trim().replace(/\s+/g, " ");
  const firstLine = cleaned.split(/[\n.!?]/, 1)[0]?.trim() ?? cleaned;
  const title = (firstLine || "Untitled Project").slice(0, 60);
  const description = cleaned.slice(0, 200) || "New project.";
  return { title, description };
};

export type GenerateTitleOptions = {
  prompt: string;
  provider: string;
  model?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
};

export const generateProjectTitle = async (
  opts: GenerateTitleOptions,
): Promise<ProjectTitle> => {
  const prompt = opts.prompt.trim();
  if (!prompt) return heuristicFallback(prompt);

  const timeoutMs = opts.timeoutMs ?? 15000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abort = opts.signal
    ? new AbortController()
    : controller;
  if (opts.signal) {
    opts.signal.addEventListener("abort", () => abort.abort(), { once: true });
    controller.signal.addEventListener("abort", () => abort.abort(), { once: true });
  }

  try {
    const model = await resolveModel(opts.provider, opts.model);
    const result = await generateText({
      model,
      system: SYSTEM,
      prompt,
      experimental_output: Output.object({ schema: titleSchema }),
      abortSignal: abort.signal,
    });
    const parsed = result.experimental_output;
    return {
      title: parsed.title.trim().slice(0, 60),
      description: parsed.description.trim().slice(0, 200),
    };
  } catch (err) {
    console.warn("titler failed, falling back to heuristic:", err);
    return heuristicFallback(prompt);
  } finally {
    clearTimeout(timer);
  }
};
