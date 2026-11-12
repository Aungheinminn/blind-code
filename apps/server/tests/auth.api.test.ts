import { describe, expect, test } from "bun:test";
import { apiEnabled, request, signUp } from "./api";

describe.skipIf(!apiEnabled)("auth", () => {
  test("signup starts a session", async () => {
    const user = await signUp();
    const me = await request("GET", "/auth/me", { cookie: user.cookie });
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe(user.email);
  });

  test("a second signup with the same email is rejected", async () => {
    const user = await signUp();
    const res = await request("POST", "/auth/signup", {
      body: { email: user.email, password: "another-password", displayName: "Dup" },
    });
    expect(res.status).toBe(409);
  });

  test("login checks the password", async () => {
    const user = await signUp();
    const bad = await request("POST", "/auth/login", { body: { email: user.email, password: "wrong-password" } });
    expect(bad.status).toBe(401);
    const good = await request("POST", "/auth/login", {
      body: { email: user.email, password: "correct-horse-battery" },
    });
    expect(good.status).toBe(200);
    expect(good.headers.get("set-cookie")).toContain("=");
  });

  test("logout ends the session", async () => {
    const user = await signUp();
    await request("POST", "/auth/logout", { cookie: user.cookie });
    const me = await request("GET", "/auth/me", { cookie: user.cookie });
    expect(me.status).toBe(401);
  });

  test("a made-up session cookie is rejected", async () => {
    const user = await signUp();
    const forged = user.cookie.replace(/=.*/, "=not-a-real-session");
    const me = await request("GET", "/auth/me", { cookie: forged });
    expect(me.status).toBe(401);
  });
});
