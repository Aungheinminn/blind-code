import { beforeAll, describe, expect, test } from "bun:test";
import { apiEnabled, createProject, request, signUp, type TestUser } from "./api";

describe.skipIf(!apiEnabled)("projects", () => {
  let owner: TestUser;
  let other: TestUser;

  beforeAll(async () => {
    owner = await signUp();
    other = await signUp();
  });

  test("create, rename, list", async () => {
    const p = await createProject(owner, "First");
    const renamed = await request("PUT", `/projects/${p.id}`, { cookie: owner.cookie, body: { name: "Renamed" } });
    expect(renamed.status).toBe(200);
    expect(renamed.body.data.name).toBe("Renamed");

    const list = await request("GET", "/projects", { cookie: owner.cookie });
    expect(list.status).toBe(200);
    expect(list.body.data.items.map((i: { id: string }) => i.id)).toContain(p.id);
  });

  test("delete hides a project until it's restored", async () => {
    const p = await createProject(owner);
    expect((await request("DELETE", `/projects/${p.id}`, { cookie: owner.cookie })).status).toBe(200);
    expect((await request("GET", `/projects/${p.id}`, { cookie: owner.cookie })).status).toBe(404);
    expect((await request("POST", `/projects/${p.id}/restore`, { cookie: owner.cookie })).status).toBe(200);
    expect((await request("GET", `/projects/${p.id}`, { cookie: owner.cookie })).status).toBe(200);
  });

  test("permanent delete removes it", async () => {
    const p = await createProject(owner);
    expect((await request("DELETE", `/projects/${p.id}/permanent`, { cookie: owner.cookie })).status).toBe(200);
    expect((await request("POST", `/projects/${p.id}/restore`, { cookie: owner.cookie })).status).toBe(404);
  });

  test("rejects names that are too long", async () => {
    const res = await request("POST", "/projects", { cookie: owner.cookie, body: { name: "x".repeat(161) } });
    expect(res.status).toBe(400);
  });

  test("signed-out requests are rejected", async () => {
    const p = await createProject(owner);
    for (const [method, path] of [
      ["GET", "/projects"],
      ["POST", "/projects"],
      ["GET", `/projects/${p.id}`],
      ["GET", `/projects/${p.id}/files`],
      ["GET", `/projects/${p.id}/history`],
      ["GET", `/projects/${p.id}/checkpoints`],
      ["POST", `/projects/${p.id}/share`],
      ["DELETE", `/projects/${p.id}`],
    ] as const) {
      const res = await request(method, path, method === "POST" ? { body: {} } : {});
      expect({ method, path, status: res.status }).toEqual({ method, path, status: 401 });
    }
  });

  test("another user can't see or change the project", async () => {
    const p = await createProject(owner, "Private");
    for (const [method, path, body] of [
      ["GET", `/projects/${p.id}`],
      ["GET", `/projects/${p.id}/files`],
      ["GET", `/projects/${p.id}/history`],
      ["GET", `/projects/${p.id}/checkpoints`],
      ["GET", `/projects/${p.id}/design-template`],
      ["PUT", `/projects/${p.id}`, { name: "Hijacked" }],
      ["POST", `/projects/${p.id}/share`, {}],
      ["DELETE", `/projects/${p.id}/share`],
      ["DELETE", `/projects/${p.id}`],
      ["DELETE", `/projects/${p.id}/permanent`],
    ] as const) {
      const res = await request(method, path, { cookie: other.cookie, body });
      expect({ method, path, status: res.status }).toEqual({ method, path, status: 404 });
    }

    const list = await request("GET", "/projects", { cookie: other.cookie });
    expect(list.body.data.items.map((i: { id: string }) => i.id)).not.toContain(p.id);

    const still = await request("GET", `/projects/${p.id}`, { cookie: owner.cookie });
    expect(still.status).toBe(200);
    expect(still.body.data.name).toBe("Private");
    expect(still.body.data.shareToken).toBeNull();
  });
});
