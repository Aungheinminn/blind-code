import { writable } from "svelte/store";
import {
  deleteProviderKey,
  getConnect,
  getOpenRouterModels,
  setEnabledModels as apiSetEnabledModels,
  setProviderKey,
  type ConnectData,
  type ModelInfo,
  type OpenRouterModel,
  type ProviderStatus,
} from "$lib/api/connect";

export const providersState = writable<ProviderStatus[]>([]);
export const catalog = writable<Record<string, ModelInfo[]>>({});
export const enabledModels = writable<Record<string, string[]>>({});
export const connectLoading = writable(false);
export const connectError = writable<string | null>(null);

const applyData = (data: ConnectData) => {
  providersState.set(data.providers);
  catalog.set(data.catalogByProvider);
  enabledModels.set(data.enabledByProvider);
};

export const loadConnect = async (): Promise<void> => {
  connectLoading.set(true);
  connectError.set(null);
  try {
    const data = await getConnect();
    applyData(data);
  } catch (e) {
    connectError.set(e instanceof Error ? e.message : String(e));
  } finally {
    connectLoading.set(false);
  }
};

export const saveKey = async (provider: string, apiKey: string): Promise<void> => {
  await setProviderKey(provider, apiKey);
  await loadConnect();
};

export const removeKey = async (provider: string): Promise<void> => {
  await deleteProviderKey(provider);
  await loadConnect();
};

export const saveEnabledModels = async (
  provider: string,
  modelIds: string[],
): Promise<void> => {
  await apiSetEnabledModels(provider, modelIds);
  enabledModels.update((m) => ({ ...m, [provider]: modelIds }));
};

export const openRouterModels = writable<OpenRouterModel[]>([]);
export const openRouterFetchedAt = writable<number | null>(null);
export const openRouterLoading = writable(false);
export const openRouterError = writable<string | null>(null);

export const loadOpenRouterModels = async (forceRefresh = false): Promise<void> => {
  openRouterLoading.set(true);
  openRouterError.set(null);
  try {
    const { models, fetchedAt } = await getOpenRouterModels(forceRefresh);
    openRouterModels.set(models);
    openRouterFetchedAt.set(fetchedAt);
  } catch (e) {
    openRouterError.set(e instanceof Error ? e.message : String(e));
  } finally {
    openRouterLoading.set(false);
  }
};
