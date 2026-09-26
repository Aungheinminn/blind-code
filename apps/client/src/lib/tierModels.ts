// Mirror of packages/shared/schema/models.ts — kept in sync manually so the
// client bundle doesn't pull in the shared package's drizzle deps.
export type Tier = "low" | "medium" | "high";
export type TierProvider = "openai" | "anthropic" | "google";

export type TierModel = {
  id: string;
  label: string;
  tier: Tier;
  provider: TierProvider;
};

export const TIER_MODELS: TierModel[] = [
  { id: "gpt-5.6-luna", label: "GPT-5.6 Luna", tier: "low", provider: "openai" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", tier: "low", provider: "anthropic" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", tier: "low", provider: "google" },
  { id: "gpt-5.6-terra", label: "GPT-5.6 Terra", tier: "medium", provider: "openai" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", tier: "medium", provider: "anthropic" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", tier: "medium", provider: "google" },
  { id: "gpt-5.6-sol", label: "GPT-5.6 Sol", tier: "high", provider: "openai" },
  { id: "claude-opus-4-7", label: "Claude Opus 4.7", tier: "high", provider: "anthropic" },
];

export const TIER_ORDER: Tier[] = ["low", "medium", "high"];

export const providerForModel = (id: string): TierProvider | null =>
  TIER_MODELS.find((m) => m.id === id)?.provider ?? null;
