import { beforeAll, describe, expect, test } from "bun:test";
import { upsertProjectFile } from "../db/repo";
import { apiEnabled, createProject, request, signUp, type TestUser } from "./api";

describe.skipIf(!apiEnabled)("share links", () => {
  let owner: TestUser;

  beforeAll(async () => {
    owner = await signUp();
  });

  test("a link shows the latest files without signing in", async () => {
    const p = await createProject(owner, "Shared app");
    await upsertProjectFile(p.id, "App.tsx", "export default () => <h1>v1</h1>;");

    const on = await request("POST", `/projects/${p.id}/share`, { cookie: owner.cookie });
    expect(on.status).toBe(200);
    const token = on.body.data.shareToken as string;
    expect(token).toMatch(/^[A-Za-z0-9_-]{16,64}$/);

    await upsertProjectFile(p.id, "App.tsx", "export default () => <h1>v2</h1>;");
    const pub = await request("GET", `/share/${token}`);
    expect(pub.status).toBe(200);
    expect(pub.body.data.name).toBe("Shared app");
    expect(pub.body.data.files).toEqual({ "App.tsx": "export default () => <h1>v2</h1>;" });
  });

  test("the public page only returns what the preview needs", async () => {
    const p = await createProject(owner);
    const token = (await request("POST", `/projects/${p.id}/share`, { cookie: owner.cookie })).body.data.shareToken;
    const pub = await request("GET", `/share/${token}`);
    expect(Object.keys(pub.body.data).sort()).toEqual(["description", "designCss", "files", "name", "supabase"]);
  });

  test("turning it on twice keeps the same link", async () => {
    const p = await createProject(owner);
    const a = await request("POST", `/projects/${p.id}/share`, { cookie: owner.cookie });
    const b = await request("POST", `/projects/${p.id}/share`, { cookie: owner.cookie });
    expect(b.body.data.shareToken).toBe(a.body.data.shareToken);
  });

  test("turning it off breaks the link, and turning it on again makes a new one", async () => {
    const p = await createProject(owner);
    const first = (await request("POST", `/projects/${p.id}/share`, { cookie: owner.cookie })).body.data.shareToken;
    const off = await request("DELETE", `/projects/${p.id}/share`, { cookie: owner.cookie });
    expect(off.status).toBe(200);
    expect((await request("GET", `/share/${first}`)).status).toBe(404);

    const second = (await request("POST", `/projects/${p.id}/share`, { cookie: owner.cookie })).body.data.shareToken;
    expect(second).not.toBe(first);
    expect((await request("GET", `/share/${second}`)).status).toBe(200);
  });

  test("deleting the project breaks the link", async () => {
    const p = await createProject(owner);
    const token = (await request("POST", `/projects/${p.id}/share`, { cookie: owner.cookie })).body.data.shareToken;
    await request("DELETE", `/projects/${p.id}`, { cookie: owner.cookie });
    expect((await request("GET", `/share/${token}`)).status).toBe(404);
  });

  test("made-up and malformed links are not found", async () => {
    expect((await request("GET", `/share/${"a".repeat(24)}`)).status).toBe(404);
    expect((await request("GET", "/share/short")).status).toBe(404);
    expect((await request("GET", "/share/has%20space%20in%20it%20padding")).status).toBe(404);
  });
});
