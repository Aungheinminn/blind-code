import { generateText } from "ai";
import { TIER_MODELS } from "@vibe/shared";
import { resolveModel, type KeyPreference } from "./providers";
import type { CoderChatMessage } from "./coder";
import { estimateTokens } from "./context";

const MAX_INPUT_TOKENS = 40_000;
const MAX_MESSAGE_CHARS = 6_000;

const SYSTEM = `You maintain the long-term memory of a coding agent that builds a small React + TypeScript web app with a user over many chat turns. Older turns are about to fall out of the agent's context window. Merge them into the existing memory.

Keep:
- What the user is building and the features they asked for.
- Decisions, constraints, and preferences the user stated (styling, naming, libraries, things they said NOT to do).
- The current state of features: built, partially built, broken, or abandoned.
- Known bugs or open follow-ups.

Drop: greetings, tool chatter, step-by-step narration, and anything the project files already make obvious.

Rules:
- Plain markdown bullets under short headings. No preamble.
- Newer turns win when they contradict older memory.
- Stay under 400 words.`;

// Summaries run often, so they use the provider's low tier rather than the
// model the user picked for coding.
export const summaryModelFor = (provider: string, fallbackModel?: string): string | undefined =>
  TIER_MODELS.find((m) => m.provider === provider && m.tier === "low")?.id ?? fallbackModel;

const formatTurns = (messages: CoderChatMessage[]): string => {
  const lines: string[] = [];
  let used = 0;
  // Newest first so that, if the backlog is huge, the recent part survives.
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    const body =
      m.content.length > MAX_MESSAGE_CHARS ? `${m.content.slice(0, MAX_MESSAGE_CHARS)} …` : m.content;
    const line = `${m.role === "user" ? "USER" : "AGENT"}: ${body}`;
    const cost = estimateTokens(line);
    if (used + cost > MAX_INPUT_TOKENS) break;
    used += cost;
    lines.unshift(line);
  }
  return lines.join("\n\n");
};

export type SummarizeOptions = {
  provider: string;
  model?: string;
  userId: string | null;
  keyPreference?: KeyPreference;
  previousSummary: string | null;
  turns: CoderChatMessage[];
  signal?: AbortSignal;
};

export const summarizeConversation = async (
  opts: SummarizeOptions,
): Promise<{ summary: string; model: string | undefined; usage?: unknown }> => {
  const model = summaryModelFor(opts.provider, opts.model);
  const languageModel = await resolveModel(
    opts.provider,
    model,
    opts.userId,
    opts.keyPreference ?? "auto",
  );
  const prompt = `EXISTING MEMORY:\n${opts.previousSummary?.trim() || "(none yet)"}\n\nOLDER TURNS TO MERGE:\n${formatTurns(opts.turns)}`;
  const result = await generateText({
    model: languageModel,
    system: SYSTEM,
    prompt,
    maxOutputTokens: 1_500,
    abortSignal: opts.signal,
  });
  return { summary: result.text.trim(), model, usage: result.usage };
};

export const buildProjectMemoryAppendix = (summary: string): string =>
  `PROJECT MEMORY\n\nEarlier parts of this conversation no longer fit in context. This is a summary of them, written by you in previous turns. Treat it as background; the current project files are the source of truth if they disagree.\n\n<project-memory>\n${summary}\n</project-memory>`;
