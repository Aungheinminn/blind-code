import { hasDb } from "../db/client";
import { createApp } from "../app";

if (process.env.CI && !hasDb) {
  throw new Error("TEST_DATABASE_URL must be set in CI, or the API tests silently skip.");
}

export const apiEnabled = hasDb;

const app = createApp();
let ipCounter = 0;

export type Res<T = any> = { status: number; body: T; headers: Headers };

export const request = async <T = any>(
  method: string,
  path: string,
  opts: { cookie?: string; body?: unknown } = {},
): Promise<Res<T>> => {
  const headers: Record<string, string> = {};
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  const res = await app.handle(
    new Request(`http://localhost${path}`, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    }),
  );
  const text = await res.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {}
  return { status: res.status, body, headers: res.headers };
};

export type TestUser = { id: string; email: string; cookie: string };

// Signup is rate limited per IP, so each user comes from its own address.
export const signUp = async (): Promise<TestUser> => {
  const email = `t-${crypto.randomUUID()}@example.test`;
  const res = await app.handle(
    new Request("http://localhost/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `10.0.${++ipCounter}.1` },
      body: JSON.stringify({ email, password: "correct-horse-battery", displayName: "Tester" }),
    }),
  );
  if (res.status !== 200) throw new Error(`signup failed: ${res.status} ${await res.text()}`);
  const setCookie = res.headers.get("set-cookie") ?? "";
  const cookie = setCookie.split(";")[0];
  const body = (await res.json()) as { data: { user: { id: string } } };
  return { id: body.data.user.id, email, cookie };
};

export const createProject = async (user: TestUser, name = `p-${crypto.randomUUID()}`) => {
  const res = await request("POST", "/projects", { cookie: user.cookie, body: { name } });
  if (res.status !== 200) throw new Error(`create project failed: ${res.status}`);
  return res.body.data as { id: string; name: string };
};
