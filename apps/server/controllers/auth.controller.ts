import type { Elysia } from "elysia";
import { z } from "zod";
import { hasDb } from "../db/client";
import { createUser, findUserByEmail } from "../db/repo";
import { hashPassword, verifyPassword } from "../services/password";
import {
  buildClearCookie,
  buildSessionCookie,
  createSession,
  deleteSession,
  readSessionCookie,
} from "../services/session";
import { getUserFromRequest } from "../services/authGuard";
import { mintTicket } from "../services/wsTicket";

const signupSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(200),
  displayName: z.string().trim().min(1).max(120),
});

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(200),
});

const publicUser = (u: { id: string; email: string; displayName: string; avatarUrl: string | null }) => ({
  id: u.id,
  email: u.email,
  displayName: u.displayName,
  avatarUrl: u.avatarUrl,
});

const requestMeta = (request: Request) => ({
  userAgent: request.headers.get("user-agent"),
  ip:
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null,
});

export const authController = (app: Elysia) =>
  app
    .post("/auth/signup", async ({ body, request, set }) => {
      if (!hasDb) {
        set.status = 503;
        return { error: "database not configured" };
      }
      const parsed = signupSchema.safeParse(body);
      if (!parsed.success) {
        set.status = 400;
        return { error: parsed.error.issues[0]?.message ?? "invalid input" };
      }
      const { email, password, displayName } = parsed.data;
      const existing = await findUserByEmail(email);
      if (existing) {
        set.status = 409;
        return { error: "email already registered" };
      }
      const passwordHash = await hashPassword(password);
      const user = await createUser(email, displayName, passwordHash);
      if (!user) {
        set.status = 500;
        return { error: "failed to create user" };
      }
      const session = await createSession(user.id, requestMeta(request));
      if (!session) {
        set.status = 500;
        return { error: "failed to create session" };
      }
      set.headers["set-cookie"] = buildSessionCookie(session.id, session.expiresAt);
      return { data: { user: publicUser(user) } };
    })
    .post("/auth/login", async ({ body, request, set }) => {
      if (!hasDb) {
        set.status = 503;
        return { error: "database not configured" };
      }
      const parsed = loginSchema.safeParse(body);
      if (!parsed.success) {
        set.status = 400;
        return { error: "invalid input" };
      }
      const { email, password } = parsed.data;
      const user = await findUserByEmail(email);
      const ok = user ? await verifyPassword(password, user.passwordHash) : false;
      if (!user || !ok) {
        set.status = 401;
        return { error: "invalid email or password" };
      }
      const session = await createSession(user.id, requestMeta(request));
      if (!session) {
        set.status = 500;
        return { error: "failed to create session" };
      }
      set.headers["set-cookie"] = buildSessionCookie(session.id, session.expiresAt);
      return { data: { user: publicUser(user) } };
    })
    .post("/auth/logout", async ({ request, set }) => {
      const sid = readSessionCookie(request.headers.get("cookie"));
      if (sid) await deleteSession(sid);
      set.headers["set-cookie"] = buildClearCookie();
      return { data: { ok: true } };
    })
    .get("/auth/me", async ({ request, set }) => {
      const user = await getUserFromRequest(request);
      if (!user) {
        set.status = 401;
        return { error: "unauthorized" };
      }
      return { data: { user } };
    })
    .post("/auth/ws-ticket", async ({ request, set }) => {
      const user = await getUserFromRequest(request);
      if (!user) {
        set.status = 401;
        return { error: "unauthorized" };
      }
      return { data: mintTicket(user.id) };
    });
