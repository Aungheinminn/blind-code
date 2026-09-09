import { fetchJson } from "./http";

export type ProviderKeySource = "file" | "env" | null;

export type ProviderStatus = {
  name: string;
  defaultModel: string;
  configured: boolean;
  source: ProviderKeySource;
  last4: string | null;
};

export type ModelTag = "fast" | "reasoning" | "vision" | "free";

export type ModelInfo = {
  id: string;
  label: string;
  tags?: ModelTag[];
};

export type ConnectData = {
  providers: ProviderStatus[];
  catalogByProvider: Record<string, ModelInfo[]>;
  enabledByProvider: Record<string, string[]>;
};

export const getConnect = () => fetchJson<ConnectData>("/connect");

export const setProviderKey = (provider: string, apiKey: string) =>
  fetchJson<{ provider: string; saved: boolean }>(`/connect/${provider}/key`, {
    method: "PUT",
    body: JSON.stringify({ apiKey }),
  });

export const deleteProviderKey = (provider: string) =>
  fetchJson<{ provider: string; removed: boolean }>(`/connect/${provider}/key`, {
    method: "DELETE",
  });

export const setEnabledModels = (provider: string, modelIds: string[]) =>
  fetchJson<{ provider: string; count: number }>(`/connect/${provider}/models`, {
    method: "PUT",
    body: JSON.stringify({ modelIds }),
  });

export type OpenRouterModel = ModelInfo & {
  contextLength: number | null;
  promptPrice: number | null;
};

export const getOpenRouterModels = (forceRefresh = false) =>
  fetchJson<{ models: OpenRouterModel[]; fetchedAt: number }>(
    `/connect/openrouter/models${forceRefresh ? "?refresh=1" : ""}`,
  );
