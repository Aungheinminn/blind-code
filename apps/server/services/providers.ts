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
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { getStoredKey, last4 } from "./authStore";

const thinkTagMiddleware = extractReasoningMiddleware({ tagName: "think" });

// OpenRouter sometimes proxies models (DeepSeek-R1, Qwen-thinking, GLM) that
// emit reasoning inside <think>...</think> tags in the plain text stream.
// Strip those so the transcript doesn't get a wall of think-tag text.
const emitsThinkTag = (provider: ProviderName, modelId: string): boolean => {
  if (provider !== "openrouter") return false;
  const id = modelId.toLowerCase();
  return id.includes("deepseek-r1") || id.includes("qwen") || id.includes("glm");
};

const wrapIfThinkTag = (
  provider: ProviderName,
  modelId: string,
  model: WrappedLanguageModel,
): WrappedLanguageModel =>
  emitsThinkTag(provider, modelId)
    ? wrapLanguageModel({ model, middleware: thinkTagMiddleware })
    : model;

export type ProviderName = "anthropic" | "openai" | "google" | "openrouter";

type ProviderEntry = {
  envVar: string;
  defaultModel: string;
  build: (modelId: string, apiKey: string) => LanguageModel;
};

export const PROVIDERS: Record<ProviderName, ProviderEntry> = {
  anthropic: {
    envVar: "ANTHROPIC_API_KEY",
    defaultModel: "claude-sonnet-4-6",
    build: (id, apiKey) => createAnthropic({ apiKey })(id),
  },
  openai: {
    envVar: "OPENAI_API_KEY",
    defaultModel: "gpt-5.6-terra",
    build: (id, apiKey) => createOpenAI({ apiKey }).responses(id),
  },
  google: {
    envVar: "GOOGLE_GENERATIVE_AI_API_KEY",
    defaultModel: "gemini-2.5-flash",
    build: (id, apiKey) => createGoogleGenerativeAI({ apiKey })(id),
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
