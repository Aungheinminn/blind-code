// Per-million-token USD pricing for every model in the UI picker.
// Verified against provider pricing pages on 2026-10-07.
// Update when provider rates change.
export type ModelPrice = { input: number; output: number };

export const MODEL_PRICING: Record<string, ModelPrice> = {
  // Anthropic — claude.com/pricing
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "claude-opus-4-7": { input: 5.0, output: 25.0 },
  // OpenAI — developers.openai.com/api/docs/models
  "gpt-5.6-luna": { input: 0.2, output: 1.2 },
  "gpt-5.6-terra": { input: 2.0, output: 12.0 },
  "gpt-5.6-sol": { input: 4.0, output: 20.0 },
  // Google — ai.google.dev/gemini-api/docs/pricing
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gemini-2.5-pro": { input: 1.25, output: 10.0 },
};

export type UsageTokens = {
  inputTokens: number;
  outputTokens: number;
};

// 1 credit == $0.01 of raw API cost. Sale-price markup is a separate
// business layer applied at Phase 4 (payment) — not here.
const USD_PER_CREDIT = 0.01;

export const creditsFor = (model: string, usage: UsageTokens): number => {
  const price = MODEL_PRICING[model];
  if (!price) {
    throw new Error(
      `No pricing configured for model "${model}" — add it to MODEL_PRICING in services/pricing.ts`,
    );
  }
  const costUsd =
    (usage.inputTokens * price.input + usage.outputTokens * price.output) /
    1_000_000;
  // Round up so sub-credit calls still cost something and favour the house.
  return Math.ceil(costUsd / USD_PER_CREDIT);
};

export const hasPricing = (model: string): boolean =>
  Object.prototype.hasOwnProperty.call(MODEL_PRICING, model);
