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
