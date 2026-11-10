import type {
  ProjectIntegrations,
  ProviderKey,
  UserIntegrations,
  UserProviderKeys,
} from "@vibe/shared";
import { isUuid, stringToUuid } from "../../services/uuid";
import { encrypt, decryptMaybe } from "../../services/crypto";

export const encryptProviderKeys = (
  providers: UserProviderKeys | undefined,
): UserProviderKeys | undefined => {
  if (!providers) return providers;
  const out: UserProviderKeys = {};
  for (const [name, blob] of Object.entries(providers) as Array<
    [keyof UserProviderKeys, ProviderKey | undefined]
  >) {
    if (!blob) continue;
    out[name] = { ...blob, apiKey: encrypt(blob.apiKey) };
  }
  return out;
};

export const decryptProviderKeys = (
  providers: UserProviderKeys | undefined,
): UserProviderKeys | undefined => {
  if (!providers) return providers;
  const out: UserProviderKeys = {};
  for (const [name, blob] of Object.entries(providers) as Array<
    [keyof UserProviderKeys, ProviderKey | undefined]
  >) {
    if (!blob) continue;
    const plain = decryptMaybe(blob.apiKey);
    out[name] = { ...blob, apiKey: plain ?? "" };
  }
  return out;
};

export const encryptUserIntegrations = (
  integrations: UserIntegrations,
): UserIntegrations => {
  const out: UserIntegrations = { ...integrations };
  if (integrations.supabase) {
    out.supabase = {
      ...integrations.supabase,
      accessToken: encrypt(integrations.supabase.accessToken),
    };
  }
  if (integrations.vercel) {
    out.vercel = {
      ...integrations.vercel,
      apiToken: encrypt(integrations.vercel.apiToken),
    };
  }
  if (integrations.github) {
    out.github = {
      ...integrations.github,
      accessToken: encrypt(integrations.github.accessToken),
    };
  }
  if (integrations.providers) {
    out.providers = encryptProviderKeys(integrations.providers);
  }
  return out;
};

export const decryptUserIntegrations = (
  integrations: UserIntegrations | null | undefined,
): UserIntegrations | null => {
  if (!integrations) return null;
  const out: UserIntegrations = { ...integrations };
  if (integrations.supabase) {
    const at = decryptMaybe(integrations.supabase.accessToken);
    out.supabase = { ...integrations.supabase, accessToken: at ?? "" };
  }
  if (integrations.vercel) {
    const tok = decryptMaybe(integrations.vercel.apiToken);
    out.vercel = { ...integrations.vercel, apiToken: tok ?? "" };
  }
  if (integrations.github) {
    const tok = decryptMaybe(integrations.github.accessToken);
    out.github = { ...integrations.github, accessToken: tok ?? "" };
  }
  if (integrations.providers) {
    out.providers = decryptProviderKeys(integrations.providers);
  }
  return out;
};

export const decryptUserRow = <T extends { integrations?: UserIntegrations | null }>(
  row: T | null | undefined,
): T | null => {
  if (!row) return null;
  return { ...row, integrations: decryptUserIntegrations(row.integrations) };
};

export const encryptProjectIntegrations = (
  integrations: ProjectIntegrations,
): ProjectIntegrations => {
  if (!integrations.supabase) return integrations;
  const s = integrations.supabase;
  return {
    ...integrations,
    supabase: {
      ...s,
      serviceRoleKey: s.serviceRoleKey ? encrypt(s.serviceRoleKey) : undefined,
      databaseUrl: s.databaseUrl ? encrypt(s.databaseUrl) : undefined,
    },
  };
};

export const decryptProjectIntegrations = (
  integrations: ProjectIntegrations | null | undefined,
): ProjectIntegrations | null => {
  if (!integrations) return null;
  if (!integrations.supabase) return integrations;
  const s = integrations.supabase;
  return {
    ...integrations,
    supabase: {
      ...s,
      serviceRoleKey: s.serviceRoleKey
        ? (decryptMaybe(s.serviceRoleKey) ?? undefined)
        : undefined,
      databaseUrl: s.databaseUrl
        ? (decryptMaybe(s.databaseUrl) ?? undefined)
        : undefined,
    },
  };
};

export const decryptProjectRow = <
  T extends { integrations?: ProjectIntegrations | null },
>(
  row: T | null | undefined,
): T | null => {
  if (!row) return null;
  return { ...row, integrations: decryptProjectIntegrations(row.integrations) };
};

export const projectIdFor = (idOrName: string, ownerId: string): string =>
  isUuid(idOrName) ? idOrName.toLowerCase() : stringToUuid(`${ownerId}:${idOrName}`);

export const resolveProjectId = projectIdFor;
