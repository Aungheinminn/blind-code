import { and, eq, gt } from "drizzle-orm";
import { db, schema } from "../db/client";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const COOKIE_NAME = "sid";
const isProd = process.env.NODE_ENV === "production";

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
};

const randomSessionId = (): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `s_${hex}`;
};

export const createSession = async (
  userId: string,
  meta: { userAgent?: string | null; ip?: string | null } = {},
): Promise<{ id: string; expiresAt: Date } | null> => {
  if (!db) return null;
  const id = randomSessionId();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(schema.sessions).values({
    id,
    userId,
    expiresAt,
    userAgent: meta.userAgent ?? null,
    ip: meta.ip ?? null,
  });
  return { id, expiresAt };
};

export const getSessionUser = async (sid: string): Promise<SessionUser | null> => {
  if (!db) return null;
  const rows = await db
    .select({
      userId: schema.sessions.userId,
      expiresAt: schema.sessions.expiresAt,
      email: schema.users.email,
      displayName: schema.users.displayName,
      avatarUrl: schema.users.avatarUrl,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, sid), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.userId,
    email: row.email,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
  };
};

export const deleteSession = async (sid: string): Promise<void> => {
  if (!db) return;
  await db.delete(schema.sessions).where(eq(schema.sessions.id, sid));
};

export const readSessionCookie = (cookieHeader: string | null | undefined): string | null => {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE_NAME) return decodeURIComponent(rest.join("="));
  }
  return null;
};

export const buildSessionCookie = (sid: string, expiresAt: Date): string => {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(sid)}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Expires=${expiresAt.toUTCString()}`,
    `Max-Age=${Math.floor((expiresAt.getTime() - Date.now()) / 1000)}`,
  ];
  if (isProd) parts.push("Secure");
  return parts.join("; ");
};

export const buildClearCookie = (): string => {
  const parts = [
    `${COOKIE_NAME}=`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=0`,
  ];
  if (isProd) parts.push("Secure");
  return parts.join("; ");
};

export const SESSION_COOKIE_NAME = COOKIE_NAME;
