import { describe, expect, test } from "bun:test";
import type { ModelMessage } from "ai";
import type { CoderChatMessage } from "./coder";
import {
  compactMessagesBefore,
  contextWindowFor,
  createStepCompactor,
  estimateTokens,
  fitHistory,
} from "./context";

const u = (content: string): CoderChatMessage => ({ role: "user", content });
const a = (content: string): CoderChatMessage => ({ role: "assistant", content });
const words = (tokens: number) => "x".repeat(tokens * 4);

describe("contextWindowFor", () => {
  test("matches known families and falls back for unknown ids", () => {
    expect(contextWindowFor("claude-sonnet-4-6")).toBe(200_000);
    expect(contextWindowFor("gemini-2.5-pro")).toBe(1_000_000);
    expect(contextWindowFor("gpt-5.6-sol")).toBe(400_000);
    expect(contextWindowFor("minimax/minimax-m3:free")).toBe(128_000);
    expect(contextWindowFor(undefined)).toBe(128_000);
  });
});

describe("fitHistory", () => {
  test("keeps everything when under budget", () => {
    const history = [u("hi"), a("hello"), u("build a todo app"), a("done")];
    const { history: kept, dropped } = fitHistory(history, 10_000);
    expect(kept).toEqual(history);
    expect(dropped).toEqual([]);
  });

  test("drops oldest whole turns first", () => {
    const history = [u(words(100)), a(words(100)), u(words(50)), a(words(50))];
    const { history: kept, dropped } = fitHistory(history, 150);
    expect(kept).toEqual(history.slice(2));
    expect(dropped).toEqual(history.slice(0, 2));
  });

  test("never splits a turn across the budget edge", () => {
    const history = [u(words(10)), a(words(10)), u(words(10)), a(words(100))];
    const { history: kept } = fitHistory(history, 100);
    expect(kept).toEqual([]);
  });

  test("drops a leading orphaned assistant message", () => {
    const history = [a("interrupted reply"), u("next"), a("ok")];
    const { history: kept, dropped } = fitHistory(history, 10_000);
    expect(kept).toEqual([u("next"), a("ok")]);
    expect(dropped).toEqual([a("interrupted reply")]);
  });

  test("clips oversized messages from the middle", () => {
    const huge = "a".repeat(20_000) + "b".repeat(40_000) + "c".repeat(20_000);
    const { history: kept } = fitHistory([u(huge)], 100_000);
    const content = kept[0].content;
    expect(estimateTokens(content)).toBeLessThan(8_100);
    expect(content.startsWith("a")).toBe(true);
    expect(content.endsWith("c")).toBe(true);
    expect(content).toContain("characters omitted");
  });
});

const writeStep = (id: string, content: string): ModelMessage[] => [
  {
    role: "assistant",
    content: [{ type: "tool-call", toolCallId: id, toolName: "write_file", input: { path: "/App.tsx", content } }],
  },
  {
    role: "tool",
    content: [{ type: "tool-result", toolCallId: id, toolName: "write_file", output: { type: "json", value: { path: "/App.tsx", bytes: content.length } } }],
  },
];

const readStep = (id: string, content: string): ModelMessage[] => [
  {
    role: "assistant",
    content: [{ type: "tool-call", toolCallId: id, toolName: "read_file", input: { path: "/App.tsx" } }],
  },
  {
    role: "tool",
    content: [{ type: "tool-result", toolCallId: id, toolName: "read_file", output: { type: "json", value: { path: "/App.tsx", content } } }],
  },
];

describe("compactMessagesBefore", () => {
  test("elides stale reads and written content but leaves recent steps alone", () => {
    const messages: ModelMessage[] = [
      { role: "system", content: "sys" },
      { role: "user", content: "go" },
      ...readStep("r1", "old contents\nline 2"),
      ...writeStep("w1", "a\nb\nc"),
      ...readStep("r2", "fresh contents"),
    ];
    const out = compactMessagesBefore(messages, 6);

    expect(out.slice(0, 2)).toEqual(messages.slice(0, 2));
    expect(JSON.stringify(out[3])).not.toContain("old contents");
    expect(JSON.stringify(out[3])).toContain("elided");
    expect(JSON.stringify(out[4])).toContain("3 lines written");
    expect(out.slice(6)).toEqual(messages.slice(6));
  });

  test("leaves short unknown tool results untouched", () => {
    const messages: ModelMessage[] = [
      {
        role: "tool",
        content: [{ type: "tool-result", toolCallId: "t", toolName: "update_todo", output: { type: "json", value: { ok: true } } }],
      },
    ];
    expect(compactMessagesBefore(messages, 1)).toEqual(messages);
  });
});

describe("createStepCompactor", () => {
  const big = "x".repeat(200_000);

  test("no-op while under the threshold", () => {
    const compact = createStepCompactor("claude-sonnet-4-6");
    expect(compact({ messages: [{ role: "user", content: "hi" }, ...readStep("r1", "small")] })).toBeUndefined();
  });

  test("compacts once over the threshold and keeps the boundary stable", () => {
    const compact = createStepCompactor("minimax/unknown");
    const base: ModelMessage[] = [{ role: "user", content: "go" }];
    for (let i = 0; i < 6; i++) base.push(...readStep(`r${i}`, big));

    const first = compact({ messages: base });
    expect(first).toBeDefined();
    const firstSize = JSON.stringify(first!.messages).length;
    expect(firstSize).toBeLessThan(JSON.stringify(base).length);

    const grown = [...base, ...readStep("small", "tiny")];
    const second = compact({ messages: grown })!;
    expect(second.messages.slice(0, base.length - 6)).toEqual(first!.messages.slice(0, base.length - 6));
  });
});
