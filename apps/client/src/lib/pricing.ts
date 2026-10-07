// Mirror of apps/server/services/pricing.ts — kept in sync manually.
// Used for display-only cost hints in the model picker. The authoritative
// pricing (used for actual debits) lives on the server.
export type ModelPrice = { input: number; output: number };

export const MODEL_PRICING: Record<string, ModelPrice> = {
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "claude-opus-4-7": { input: 5.0, output: 25.0 },
  "gpt-5.6-luna": { input: 0.2, output: 1.2 },
  "gpt-5.6-terra": { input: 2.0, output: 12.0 },
  "gpt-5.6-sol": { input: 4.0, output: 20.0 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gemini-2.5-pro": { input: 1.25, output: 10.0 },
};

const USD_PER_CREDIT = 0.001;

// Credits for a representative 50K-in / 50K-out session (~100K total tokens).
// Rough tier indicator for the model picker, not an exact charge.
export const sessionCreditsEstimate = (modelId: string): number | null => {
  const p = MODEL_PRICING[modelId];
  if (!p) return null;
  const costUsd = (50_000 * p.input + 50_000 * p.output) / 1_000_000;
  return Math.round(costUsd / USD_PER_CREDIT);
};
