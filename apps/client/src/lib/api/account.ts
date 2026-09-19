import { fetchJson } from "./http";

export type PublicSupabaseAccountIntegration = {
  connectedAt: string;
};

export type PublicUserIntegrations = {
  supabase?: PublicSupabaseAccountIntegration;
};

export type SupabaseAccountProject = {
  id: string;
  organization_id: string;
  name: string;
  region: string;
  created_at: string;
  status?: string;
};

export const getAccountIntegrations = () =>
  fetchJson<PublicUserIntegrations | null>("/account/integrations");

export const connectSupabaseAccount = (accessToken: string) =>
  fetchJson<PublicUserIntegrations | null>("/account/integrations/supabase", {
    method: "PUT",
    body: JSON.stringify({ accessToken }),
  });

export const disconnectSupabaseAccount = () =>
  fetchJson<PublicUserIntegrations | null>("/account/integrations/supabase", {
    method: "DELETE",
  });

export const listAccountSupabaseProjects = () =>
  fetchJson<SupabaseAccountProject[]>("/account/integrations/supabase/projects");

export type SupabaseAccountOrganization = {
  id: string;
  name: string;
  slug?: string;
};

export const listAccountSupabaseOrganizations = () =>
  fetchJson<SupabaseAccountOrganization[]>(
    "/account/integrations/supabase/organizations",
  );

export type CreateAccountSupabaseProjectInput = {
  name: string;
  organizationSlug: string;
  regionCode: string;
  dbPass: string;
};

export type CreatedAccountSupabaseProject = {
  id: string;
  name: string;
  organization_id: string;
  region: string;
  status?: string;
  created_at: string;
};

export const createAccountSupabaseProject = (
  input: CreateAccountSupabaseProjectInput,
) =>
  fetchJson<CreatedAccountSupabaseProject>(
    "/account/integrations/supabase/projects",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );

export type DeletedAccountSupabaseProject = {
  ref: string;
  deleted: boolean;
  detachedBcProjects: number;
};

export const deleteAccountSupabaseProject = (ref: string) =>
  fetchJson<DeletedAccountSupabaseProject>(
    `/account/integrations/supabase/projects/${encodeURIComponent(ref)}`,
    { method: "DELETE" },
  );
