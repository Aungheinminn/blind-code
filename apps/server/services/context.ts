import type { CoderChatMessage } from "./coder";

// ~4 chars/token is close enough for budgeting across providers without
// pulling in a tokenizer per model family.
const CHARS_PER_TOKEN = 4;

export const estimateTokens = (text: string): number =>
  Math.ceil(text.length / CHARS_PER_TOKEN);

const DEFAULT_CONTEXT_WINDOW = 128_000;

const CONTEXT_WINDOWS: Array<[prefix: string, tokens: number]> = [
  ["claude-", 200_000],
  ["gemini-", 1_000_000],
  ["gpt-5", 400_000],
];

export const contextWindowFor = (modelId?: string | null): number => {
  const id = modelId?.trim().toLowerCase() ?? "";
  for (const [prefix, tokens] of CONTEXT_WINDOWS) {
    if (id.startsWith(prefix)) return tokens;
  }
  return DEFAULT_CONTEXT_WINDOW;
};

// Share of the window the prior conversation may occupy. The rest is left for
// the system prompt, plan, design template, and the run's own tool steps.
const HISTORY_SHARE = 0.3;

export const historyBudgetFor = (modelId?: string | null): number =>
  Math.floor(contextWindowFor(modelId) * HISTORY_SHARE);

const MAX_MESSAGE_TOKENS = 8_000;

const clipMessage = (content: string, maxTokens: number): string => {
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  if (content.length <= maxChars) return content;
  const keep = Math.floor(maxChars / 2);
  const dropped = content.length - keep * 2;
  return `${content.slice(0, keep)}\n\n[… ${dropped} characters omitted …]\n\n${content.slice(-keep)}`;
};

export type FitHistoryResult = {
  history: CoderChatMessage[];
  dropped: CoderChatMessage[];
};

// Keeps whole turns (a user message plus the assistant replies that follow it),
// newest first, until the budget is spent. A turn is never split, so the model
// never sees an answer without the question that prompted it.
export const fitHistory = (
  history: CoderChatMessage[],
  budget: number,
): FitHistoryResult => {
  const clipped = history.map((m) => ({
    role: m.role,
    content: clipMessage(m.content, MAX_MESSAGE_TOKENS),
  }));

  const turns: CoderChatMessage[][] = [];
  for (const m of clipped) {
    if (m.role === "user" || turns.length === 0) turns.push([m]);
    else turns[turns.length - 1].push(m);
  }

  let used = 0;
  let firstKept = turns.length;
  for (let i = turns.length - 1; i >= 0; i--) {
    const cost = turns[i].reduce((n, m) => n + estimateTokens(m.content), 0);
    if (used + cost > budget) break;
    used += cost;
    firstKept = i;
  }

  const kept = turns.slice(firstKept).flat();
  // A leading assistant message (orphaned by an interrupted turn) confuses some
  // providers' role-alternation checks.
  while (kept.length > 0 && kept[0].role !== "user") kept.shift();

  const keptCount = kept.length;
  const dropped = history.slice(0, history.length - keptCount);
  return { history: kept, dropped };
};
