import { fetchJson } from "./http";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
};

export const signup = (email: string, password: string, displayName: string) =>
  fetchJson<{ user: AuthUser }>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, displayName }),
  });

export const login = (email: string, password: string) =>
  fetchJson<{ user: AuthUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

export const logout = () =>
  fetchJson<{ ok: boolean }>("/auth/logout", { method: "POST" });

export const me = () => fetchJson<{ user: AuthUser }>("/auth/me");

export type ProfilePatch = {
  displayName?: string;
  email?: string;
  avatarUrl?: string | null;
  currentPassword?: string;
};

export const updateProfile = (patch: ProfilePatch) =>
  fetchJson<{ user: AuthUser }>("/auth/me", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });

export const changePassword = (currentPassword: string, newPassword: string) =>
  fetchJson<{ ok: boolean }>("/auth/password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });

export const deleteAccount = (currentPassword: string) =>
  fetchJson<{ ok: boolean }>("/auth/me", {
    method: "DELETE",
    body: JSON.stringify({ currentPassword }),
  });

export const getWsTicket = () =>
  fetchJson<{ ticket: string; expiresAt: number }>("/auth/ws-ticket", { method: "POST" });
