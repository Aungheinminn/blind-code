import { describe, expect, test } from "bun:test";
import { summaryModelFor } from "./summarizer";

describe("summaryModelFor", () => {
  test("uses the provider's low tier", () => {
    expect(summaryModelFor("anthropic", "claude-opus-4-7")).toBe("claude-haiku-4-5");
    expect(summaryModelFor("google", "gemini-2.5-pro")).toBe("gemini-2.5-flash");
    expect(summaryModelFor("openai", "gpt-5.6-sol")).toBe("gpt-5.6-luna");
  });

  test("falls back to the run's model for providers without tiers", () => {
    expect(summaryModelFor("openrouter", "minimax/minimax-m3:free")).toBe("minimax/minimax-m3:free");
  });
});
