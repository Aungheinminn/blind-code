import { fetchJson } from "./http";

export type ProviderKeySource = "file" | "env" | null;

export type ProviderStatus = {
  name: string;
  defaultModel: string;
  configured: boolean;
  source: ProviderKeySource;
  last4: string | null;
};

export type ConnectData = {
  providers: ProviderStatus[];
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
