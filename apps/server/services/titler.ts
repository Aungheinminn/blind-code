import { generateObject, generateText } from "ai";
import { z } from "zod";
import { resolveModel } from "./providers";

export const titleSchema = z.object({
  title: z
    .string()
    .describe("Short project name, 2-5 words, Title Case, no punctuation, no quotes."),
  description: z
    .string()
    .describe("One-sentence summary of what the app does, under 200 characters."),
});

export type ProjectTitle = z.infer<typeof titleSchema>;

const SYSTEM = `You name coding projects. Given a user's request, return a concise project title and a one-sentence description.

Rules:
- Title: 2-5 words, Title Case, no quotes, no trailing punctuation, no emojis. Prefer something a developer would name their repo (e.g. "Habit Tracker", "Kanban Board", "Standup Board").
- Description: one sentence, plain text, under 200 characters, present tense, describes what the app does.
- Do not repeat the user's prompt verbatim.`;

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "with", "for", "of", "to", "in", "on",
  "at", "by", "from", "as", "is", "are", "be", "that", "this", "it", "its",
  "some", "any", "each", "every", "one", "two", "three",
]);

const LEAD_VERBS = new Set([
  "build", "create", "make", "design", "implement", "develop", "code",
  "write", "generate", "produce",
]);

const titleCase = (word: string): string =>
  word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word;

const extractJson = (text: string): string | null => {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return cleaned.slice(start, end + 1);
};

const normalizeTitle = (raw: { title?: unknown; description?: unknown }): ProjectTitle | null => {
  if (typeof raw.title !== "string") return null;
  const title = raw.title.trim().slice(0, 60);
  if (!title) return null;
  const description =
    typeof raw.description === "string" ? raw.description.trim().slice(0, 200) : "";
  return { title, description };
};

const heuristicFallback = (prompt: string): ProjectTitle => {
  const cleaned = prompt.trim().replace(/\s+/g, " ");
  const firstLine = (cleaned.split(/[\n.!?]/, 1)[0] ?? cleaned).trim();
  const words = firstLine
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

  const titleWords: string[] = [];
  let sawLead = false;
  for (const w of words) {
    const lower = w.toLowerCase();
    if (!sawLead && LEAD_VERBS.has(lower)) {
      sawLead = true;
      continue;
    }
    if (STOPWORDS.has(lower)) continue;
    titleWords.push(titleCase(w));
    if (titleWords.length >= 4) break;
  }

  const title = (titleWords.join(" ") || "New Project").slice(0, 60);
  const description = (firstLine || "New project.").slice(0, 200);
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

  const fallbackDescription = heuristicFallback(prompt).description;

  try {
    const model = await resolveModel(opts.provider, opts.model);

    try {
      const result = await generateObject({
        model,
        system: SYSTEM,
        prompt,
        schema: titleSchema,
        abortSignal: abort.signal,
      });
      const normalized = normalizeTitle(result.object);
      if (normalized) {
        return { ...normalized, description: normalized.description || fallbackDescription };
      }
    } catch (err) {
      console.warn("[titler] generateObject failed, retrying in text mode:", err);
    }

    try {
      const result = await generateText({
        model,
        system:
          SYSTEM +
          '\n\nReturn ONLY a minified JSON object of the shape {"title":"...","description":"..."}. No markdown fences, no commentary, no extra keys.',
        prompt,
        abortSignal: abort.signal,
      });
      const jsonText = extractJson(result.text ?? "");
      if (jsonText) {
        const parsed = JSON.parse(jsonText) as Record<string, unknown>;
        const normalized = normalizeTitle(parsed);
        if (normalized) {
          return { ...normalized, description: normalized.description || fallbackDescription };
        }
      }
    } catch (err) {
      console.warn("[titler] text-mode fallback failed:", err);
    }

    console.error("[titler] all attempts failed, using heuristic for prompt:", prompt.slice(0, 100));
    return heuristicFallback(prompt);
  } finally {
    clearTimeout(timer);
  }
};
