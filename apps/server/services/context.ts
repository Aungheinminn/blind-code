import type { ModelMessage, ToolCallPart, ToolResultPart } from "ai";
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

const RUN_COMPACT_SHARE = 0.5;
const KEEP_RECENT_MESSAGES = 6;
const MAX_STALE_RESULT_CHARS = 4_000;

const estimateMessagesTokens = (messages: ModelMessage[]): number =>
  estimateTokens(JSON.stringify(messages));

const lineCount = (s: string): number => (s ? s.split("\n").length : 0);

const compactToolCall = (part: ToolCallPart): ToolCallPart => {
  if (part.toolName !== "write_file") return part;
  const input = part.input as { path?: string; content?: unknown } | null;
  if (!input || typeof input.content !== "string") return part;
  return {
    ...part,
    input: { path: input.path, content: `[${lineCount(input.content)} lines written; read_file to see current contents]` },
  };
};

const compactToolResult = (part: ToolResultPart): ToolResultPart => {
  const { output } = part;
  if (part.toolName === "read_file" && output.type === "json") {
    const value = output.value as { path?: string } | null;
    return {
      ...part,
      output: {
        type: "json",
        value: { path: value?.path ?? null, elided: true, note: "Stale read from an earlier step; read_file again if you need it." },
      },
    };
  }
  if (part.toolName === "list_files") {
    return {
      ...part,
      output: { type: "text", value: "[stale listing elided; call list_files again if needed]" },
    };
  }
  const serialized = JSON.stringify(output.value ?? null);
  if (serialized.length <= MAX_STALE_RESULT_CHARS) return part;
  return {
    ...part,
    output: {
      type: "text",
      value: `${serialized.slice(0, MAX_STALE_RESULT_CHARS)}\n[… truncated stale result …]`,
    },
  };
};

const compactMessage = (message: ModelMessage): ModelMessage => {
  if (message.role === "assistant" && Array.isArray(message.content)) {
    return {
      ...message,
      content: message.content.map((p) => (p.type === "tool-call" ? compactToolCall(p) : p)),
    };
  }
  if (message.role === "tool") {
    return {
      ...message,
      content: message.content.map((p) => (p.type === "tool-result" ? compactToolResult(p) : p)),
    };
  }
  return message;
};

export const compactMessagesBefore = (
  messages: ModelMessage[],
  boundary: number,
): ModelMessage[] => messages.map((m, i) => (i < boundary ? compactMessage(m) : m));

// Builds a prepareStep handler that elides stale file contents from earlier
// steps once the run approaches the window. The boundary only moves forward in
// jumps, and compaction is deterministic, so the prompt prefix stays
// byte-identical between jumps and provider prompt caching keeps hitting.
export const createStepCompactor = (modelId?: string | null) => {
  const threshold = Math.floor(contextWindowFor(modelId) * RUN_COMPACT_SHARE);
  let boundary = 0;

  return ({ messages }: { messages: ModelMessage[] }): { messages: ModelMessage[] } | undefined => {
    let current = boundary > 0 ? compactMessagesBefore(messages, boundary) : messages;
    if (estimateMessagesTokens(current) > threshold) {
      const next = messages.length - KEEP_RECENT_MESSAGES;
      if (next > boundary) {
        boundary = next;
        current = compactMessagesBefore(messages, boundary);
      }
    }
    return current === messages ? undefined : { messages: current };
  };
};
