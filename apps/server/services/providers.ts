import type { LanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createMistral } from "@ai-sdk/mistral";
import { createGroq } from "@ai-sdk/groq";
import { createXai } from "@ai-sdk/xai";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createCohere } from "@ai-sdk/cohere";
import { createPerplexity } from "@ai-sdk/perplexity";
import { createTogetherAI } from "@ai-sdk/togetherai";
import { createFireworks } from "@ai-sdk/fireworks";
import { createCerebras } from "@ai-sdk/cerebras";

export type ProviderName =
  | "anthropic"
  | "openai"
  | "google"
  | "mistral"
  | "groq"
  | "xai"
  | "deepseek"
  | "cohere"
  | "perplexity"
  | "togetherai"
  | "fireworks"
  | "cerebras";

type ProviderEntry = {
  envVar: string;
  defaultModel: string;
  build: (modelId: string) => LanguageModel;
};

export const PROVIDERS: Record<ProviderName, ProviderEntry> = {
  anthropic: {
    envVar: "ANTHROPIC_API_KEY",
    defaultModel: "claude-sonnet-4-5",
    build: (id) => createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(id),
  },
  openai: {
    envVar: "OPENAI_API_KEY",
    defaultModel: "gpt-4o",
    build: (id) => createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(id),
  },
  google: {
    envVar: "GOOGLE_GENERATIVE_AI_API_KEY",
    defaultModel: "gemini-2.0-flash",
    build: (id) =>
      createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })(id),
  },
  mistral: {
    envVar: "MISTRAL_API_KEY",
    defaultModel: "mistral-large-latest",
    build: (id) => createMistral({ apiKey: process.env.MISTRAL_API_KEY })(id),
  },
  groq: {
    envVar: "GROQ_API_KEY",
    defaultModel: "llama-3.3-70b-versatile",
    build: (id) => createGroq({ apiKey: process.env.GROQ_API_KEY })(id),
  },
  xai: {
    envVar: "XAI_API_KEY",
    defaultModel: "grok-2-latest",
    build: (id) => createXai({ apiKey: process.env.XAI_API_KEY })(id),
  },
  deepseek: {
    envVar: "DEEPSEEK_API_KEY",
    defaultModel: "deepseek-chat",
    build: (id) => createDeepSeek({ apiKey: process.env.DEEPSEEK_API_KEY })(id),
  },
  cohere: {
    envVar: "COHERE_API_KEY",
    defaultModel: "command-r-plus",
    build: (id) => createCohere({ apiKey: process.env.COHERE_API_KEY })(id),
  },
  perplexity: {
    envVar: "PERPLEXITY_API_KEY",
    defaultModel: "sonar-pro",
    build: (id) => createPerplexity({ apiKey: process.env.PERPLEXITY_API_KEY })(id),
  },
  togetherai: {
    envVar: "TOGETHER_AI_API_KEY",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    build: (id) => createTogetherAI({ apiKey: process.env.TOGETHER_AI_API_KEY })(id),
  },
  fireworks: {
    envVar: "FIREWORKS_API_KEY",
    defaultModel: "accounts/fireworks/models/llama-v3p3-70b-instruct",
    build: (id) => createFireworks({ apiKey: process.env.FIREWORKS_API_KEY })(id),
  },
  cerebras: {
    envVar: "CEREBRAS_API_KEY",
    defaultModel: "llama3.3-70b",
    build: (id) => createCerebras({ apiKey: process.env.CEREBRAS_API_KEY })(id),
  },
};

export const resolveModel = (provider: string, modelId?: string): LanguageModel => {
  const entry = PROVIDERS[provider as ProviderName];
  if (!entry) throw new Error(`Unknown provider: ${provider}`);
  if (!process.env[entry.envVar]) {
    throw new Error(`Missing env var ${entry.envVar} for provider ${provider}`);
  }
  return entry.build(modelId?.trim() || entry.defaultModel);
};

export const listAvailableProviders = () =>
  (Object.entries(PROVIDERS) as Array<[ProviderName, ProviderEntry]>).map(([name, entry]) => ({
    name,
    envVar: entry.envVar,
    defaultModel: entry.defaultModel,
    configured: Boolean(process.env[entry.envVar]),
  }));
