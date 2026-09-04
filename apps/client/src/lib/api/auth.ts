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
