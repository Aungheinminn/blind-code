import { readSessionCookie, getSessionUser, type SessionUser } from "./session";

export const getUserFromRequest = async (request: Request): Promise<SessionUser | null> => {
  const sid = readSessionCookie(request.headers.get("cookie"));
  if (!sid) return null;
  return getSessionUser(sid);
};

export type { SessionUser };
