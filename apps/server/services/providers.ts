import {
  extractReasoningMiddleware,
  streamText,
  wrapLanguageModel,
  type LanguageModel,
} from "ai";

type WrappedLanguageModel = Parameters<typeof wrapLanguageModel>[0]["model"];
type StreamTextProviderOptions = NonNullable<
  Parameters<typeof streamText>[0]["providerOptions"]
>;
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
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { getStoredKey, last4 } from "./authStore";

const thinkTagMiddleware = extractReasoningMiddleware({ tagName: "think" });

const emitsThinkTag = (provider: ProviderName, modelId: string): boolean => {
  const id = modelId.toLowerCase();
  switch (provider) {
    case "perplexity":
      return id.startsWith("sonar-reasoning") || id.startsWith("sonar-deep-research");
    case "openrouter":
      return id.includes("deepseek-r1") || id.includes("qwen");
    case "togetherai":
      return id.includes("deepseek-r1") || id.includes("qwen");
    case "fireworks":
      return id.includes("deepseek-r1");
    case "cerebras":
      return id.startsWith("qwen") || id.startsWith("deepseek");
    default:
      return false;
  }
};

const wrapIfThinkTag = (
  provider: ProviderName,
  modelId: string,
  model: WrappedLanguageModel,
): WrappedLanguageModel =>
  emitsThinkTag(provider, modelId)
    ? wrapLanguageModel({ model, middleware: thinkTagMiddleware })
    : model;

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
  | "cerebras"
  | "openrouter";

type ProviderEntry = {
  envVar: string;
  defaultModel: string;
  build: (modelId: string, apiKey: string) => LanguageModel;
};

export const PROVIDERS: Record<ProviderName, ProviderEntry> = {
  anthropic: {
    envVar: "ANTHROPIC_API_KEY",
    defaultModel: "claude-sonnet-4-5",
    build: (id, apiKey) => createAnthropic({ apiKey })(id),
  },
  openai: {
    envVar: "OPENAI_API_KEY",
    defaultModel: "gpt-4o",
    build: (id, apiKey) => createOpenAI({ apiKey }).responses(id),
  },
  google: {
    envVar: "GOOGLE_GENERATIVE_AI_API_KEY",
    defaultModel: "gemini-2.0-flash",
    build: (id, apiKey) => createGoogleGenerativeAI({ apiKey })(id),
  },
  mistral: {
    envVar: "MISTRAL_API_KEY",
    defaultModel: "mistral-large-latest",
    build: (id, apiKey) => createMistral({ apiKey })(id),
  },
  groq: {
    envVar: "GROQ_API_KEY",
    defaultModel: "llama-3.3-70b-versatile",
    build: (id, apiKey) => createGroq({ apiKey })(id),
  },
  xai: {
    envVar: "XAI_API_KEY",
    defaultModel: "grok-2-latest",
    build: (id, apiKey) => createXai({ apiKey })(id),
  },
  deepseek: {
    envVar: "DEEPSEEK_API_KEY",
    defaultModel: "deepseek-chat",
    build: (id, apiKey) => createDeepSeek({ apiKey })(id),
  },
  cohere: {
    envVar: "COHERE_API_KEY",
    defaultModel: "command-r-plus",
    build: (id, apiKey) => createCohere({ apiKey })(id),
  },
  perplexity: {
    envVar: "PERPLEXITY_API_KEY",
    defaultModel: "sonar-pro",
    build: (id, apiKey) =>
      wrapIfThinkTag("perplexity", id, createPerplexity({ apiKey })(id)),
  },
  togetherai: {
    envVar: "TOGETHER_AI_API_KEY",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    build: (id, apiKey) =>
      wrapIfThinkTag("togetherai", id, createTogetherAI({ apiKey })(id)),
  },
  fireworks: {
    envVar: "FIREWORKS_API_KEY",
    defaultModel: "accounts/fireworks/models/llama-v3p3-70b-instruct",
    build: (id, apiKey) =>
      wrapIfThinkTag("fireworks", id, createFireworks({ apiKey })(id)),
  },
  cerebras: {
    envVar: "CEREBRAS_API_KEY",
    defaultModel: "llama3.3-70b",
    build: (id, apiKey) =>
      wrapIfThinkTag("cerebras", id, createCerebras({ apiKey })(id)),
  },
  openrouter: {
    envVar: "OPENROUTER_API_KEY",
    defaultModel: "minimax/minimax-m3:free",
    build: (id, apiKey) =>
      wrapIfThinkTag("openrouter", id, createOpenRouter({ apiKey })(id)),
  },
};

export type ProviderKeySource = "file" | "env" | null;

export type ResolvedKey = {
  apiKey: string;
  source: Exclude<ProviderKeySource, null>;
};

const envValue = (envVar: string): string | null => {
  const raw = process.env[envVar];
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
};

export const resolveKey = async (provider: string): Promise<ResolvedKey | null> => {
  const entry = PROVIDERS[provider as ProviderName];
  if (!entry) return null;
  const fromFile = await getStoredKey(provider);
  if (fromFile) return { apiKey: fromFile, source: "file" };
  const fromEnv = envValue(entry.envVar);
  if (fromEnv) return { apiKey: fromEnv, source: "env" };
  return null;
};

export const resolveModel = async (
  provider: string,
  modelId?: string,
): Promise<LanguageModel> => {
  const entry = PROVIDERS[provider as ProviderName];
  if (!entry) throw new Error(`Unknown provider: ${provider}`);
  const key = await resolveKey(provider);
  if (!key) {
    throw new Error(
      `No API key for provider ${provider}. Set one in /connect or export ${entry.envVar}.`,
    );
  }
  return entry.build(modelId?.trim() || entry.defaultModel, key.apiKey);
};

export type ProviderStatus = {
  name: ProviderName;
  defaultModel: string;
  configured: boolean;
  source: ProviderKeySource;
  last4: string | null;
};

export type ReasoningRuntimeOptions = {
  providerOptions?: StreamTextProviderOptions;
  maxOutputTokens?: number;
};

export const getReasoningProviderOptions = (
  provider: string,
  modelId?: string,
): ReasoningRuntimeOptions => {
  const entry = PROVIDERS[provider as ProviderName];
  if (!entry) return {};
  const id = (modelId?.trim() || entry.defaultModel).toLowerCase();
  switch (provider as ProviderName) {
    case "openai":
      return { providerOptions: { openai: { reasoningSummary: "auto" } } };
    case "anthropic":
      if (/^claude-(3-7|(sonnet|opus|haiku)-4)/.test(id)) {
        return {
          providerOptions: {
            anthropic: { thinking: { type: "enabled", budgetTokens: 2048 } },
          },
          maxOutputTokens: 16000,
        };
      }
      return {};
    case "google":
      if (id.startsWith("gemini-2.5")) {
        return {
          providerOptions: { google: { thinkingConfig: { includeThoughts: true } } },
        };
      }
      return {};
    case "xai":
      if (id === "grok-3-mini" || id.startsWith("grok-4")) {
        return { providerOptions: { xai: { reasoningEffort: "medium" } } };
      }
      return {};
    case "groq":
      if (id.startsWith("deepseek-r1") || id.startsWith("qwen")) {
        return { providerOptions: { groq: { reasoningFormat: "parsed" } } };
      }
      return {};
    default:
      return {};
  }
};

export const listAvailableProviders = async (): Promise<ProviderStatus[]> => {
  const entries = Object.entries(PROVIDERS) as Array<[ProviderName, ProviderEntry]>;
  return Promise.all(
    entries.map(async ([name, entry]) => {
      const key = await resolveKey(name);
      return {
        name,
        defaultModel: entry.defaultModel,
        configured: Boolean(key),
        source: key?.source ?? null,
        last4: key ? last4(key.apiKey) : null,
      };
    }),
  );
};
