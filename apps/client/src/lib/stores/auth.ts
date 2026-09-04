import { writable, get } from "svelte/store";
import { me, type AuthUser } from "$lib/api/auth";
import { HttpError } from "$lib/api/http";

type AuthState =
  | { status: "loading"; user: null }
  | { status: "authed"; user: AuthUser }
  | { status: "anonymous"; user: null };

export const auth = writable<AuthState>({ status: "loading", user: null });

let inflight: Promise<AuthUser | null> | null = null;

export const loadCurrentUser = async (): Promise<AuthUser | null> => {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { user } = await me();
      auth.set({ status: "authed", user });
      return user;
    } catch (e) {
      if (e instanceof HttpError && e.status === 401) {
        auth.set({ status: "anonymous", user: null });
        return null;
      }
      auth.set({ status: "anonymous", user: null });
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
};

export const setAuthedUser = (user: AuthUser) => {
  auth.set({ status: "authed", user });
};

export const clearAuth = () => {
  auth.set({ status: "anonymous", user: null });
};

export const currentUser = (): AuthUser | null => {
  const s = get(auth);
  return s.status === "authed" ? s.user : null;
};
