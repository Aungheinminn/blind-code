import type { ProviderName } from "./providers";

export type ModelTag = "fast" | "reasoning" | "vision" | "free";

export type ModelInfo = {
  id: string;
  label: string;
  tags?: ModelTag[];
};

export const MODEL_CATALOG: Record<ProviderName, ModelInfo[]> = {
  anthropic: [
    { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
    { id: "claude-opus-4-1", label: "Claude Opus 4.1", tags: ["reasoning"] },
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", tags: ["fast"] },
    { id: "claude-3-7-sonnet-latest", label: "Claude Sonnet 3.7" },
  ],
  openai: [
    { id: "gpt-5", label: "GPT-5", tags: ["reasoning"] },
    { id: "gpt-5-mini", label: "GPT-5 Mini", tags: ["fast"] },
    { id: "gpt-4o", label: "GPT-4o", tags: ["vision"] },
    { id: "gpt-4o-mini", label: "GPT-4o Mini", tags: ["fast", "vision"] },
    { id: "o3", label: "o3", tags: ["reasoning"] },
    { id: "o4-mini", label: "o4-mini", tags: ["reasoning", "fast"] },
  ],
  google: [
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", tags: ["reasoning", "vision"] },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", tags: ["fast", "vision"] },
    { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", tags: ["fast", "vision"] },
  ],
  mistral: [
    { id: "mistral-large-latest", label: "Mistral Large" },
    { id: "mistral-small-latest", label: "Mistral Small", tags: ["fast"] },
    { id: "codestral-latest", label: "Codestral" },
  ],
  groq: [
    { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", tags: ["fast"] },
    { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B", tags: ["fast"] },
    { id: "deepseek-r1-distill-llama-70b", label: "DeepSeek R1 Distill 70B", tags: ["reasoning"] },
  ],
  xai: [
    { id: "grok-2-latest", label: "Grok 2" },
    { id: "grok-2-vision-latest", label: "Grok 2 Vision", tags: ["vision"] },
  ],
  deepseek: [
    { id: "deepseek-chat", label: "DeepSeek Chat" },
    { id: "deepseek-reasoner", label: "DeepSeek Reasoner", tags: ["reasoning"] },
  ],
  cohere: [
    { id: "command-r-plus", label: "Command R+" },
    { id: "command-r", label: "Command R", tags: ["fast"] },
  ],
  perplexity: [
    { id: "sonar-pro", label: "Sonar Pro" },
    { id: "sonar", label: "Sonar", tags: ["fast"] },
    { id: "sonar-reasoning-pro", label: "Sonar Reasoning Pro", tags: ["reasoning"] },
  ],
  togetherai: [
    {
      id: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
      label: "Llama 3.3 70B Turbo",
      tags: ["fast"],
    },
    { id: "deepseek-ai/DeepSeek-V3", label: "DeepSeek V3" },
    { id: "Qwen/Qwen2.5-Coder-32B-Instruct", label: "Qwen 2.5 Coder 32B" },
  ],
  fireworks: [
    {
      id: "accounts/fireworks/models/llama-v3p3-70b-instruct",
      label: "Llama 3.3 70B",
      tags: ["fast"],
    },
    {
      id: "accounts/fireworks/models/deepseek-v3",
      label: "DeepSeek V3",
    },
  ],
  cerebras: [
    { id: "llama3.3-70b", label: "Llama 3.3 70B", tags: ["fast"] },
    { id: "llama3.1-8b", label: "Llama 3.1 8B", tags: ["fast"] },
  ],
  openrouter: [
    { id: "minimax/minimax-m3:free", label: "MiniMax M3", tags: ["free"] },
    { id: "deepseek/deepseek-chat", label: "DeepSeek Chat" },
    { id: "deepseek/deepseek-r1", label: "DeepSeek R1", tags: ["reasoning"] },
    { id: "moonshotai/kimi-k2", label: "Kimi K2" },
    { id: "z-ai/glm-4.5", label: "GLM 4.5" },
    { id: "qwen/qwen-2.5-coder-32b-instruct", label: "Qwen 2.5 Coder 32B" },
  ],
};

export const DEFAULT_ENABLED: Record<ProviderName, string[]> = {
  anthropic: ["claude-sonnet-4-5", "claude-haiku-4-5"],
  openai: ["gpt-5", "gpt-5-mini"],
  google: ["gemini-2.5-flash"],
  mistral: ["mistral-large-latest"],
  groq: ["llama-3.3-70b-versatile"],
  xai: ["grok-2-latest"],
  deepseek: ["deepseek-chat"],
  cohere: ["command-r-plus"],
  perplexity: ["sonar-pro"],
  togetherai: ["meta-llama/Llama-3.3-70B-Instruct-Turbo"],
  fireworks: ["accounts/fireworks/models/llama-v3p3-70b-instruct"],
  cerebras: ["llama3.3-70b"],
  openrouter: ["minimax/minimax-m3:free"],
};

export const getCatalogFor = (provider: ProviderName): ModelInfo[] =>
  MODEL_CATALOG[provider] ?? [];

export const isKnownModel = (provider: ProviderName, modelId: string): boolean =>
  getCatalogFor(provider).some((m) => m.id === modelId);
