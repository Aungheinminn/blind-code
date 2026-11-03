import { describe, expect, test } from "bun:test";
import type { CoderChatMessage } from "./coder";
import { contextWindowFor, estimateTokens, fitHistory } from "./context";

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
