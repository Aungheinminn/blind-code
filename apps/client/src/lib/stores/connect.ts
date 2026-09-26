import { writable } from "svelte/store";
import {
  deleteProviderKey,
  getConnect,
  setProviderKey,
  type ProviderStatus,
} from "$lib/api/connect";

export const providersState = writable<ProviderStatus[]>([]);
export const connectLoading = writable(false);
export const connectError = writable<string | null>(null);

export const loadConnect = async (): Promise<void> => {
  connectLoading.set(true);
  connectError.set(null);
  try {
    const data = await getConnect();
    providersState.set(data.providers);
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
