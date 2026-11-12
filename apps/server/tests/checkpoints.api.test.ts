import { beforeAll, describe, expect, test } from "bun:test";
import {
  createAgentSession,
  createProjectCheckpoint,
  recordAgentAction,
  upsertProjectFile,
} from "../db/repo";
import { apiEnabled, createProject, request, signUp, type TestUser } from "./api";

// Does what the agent does before each prompt: save the files, then record the prompt.
const checkpoint = async (projectId: string, prompt: string) => {
  const sessionId = (await createAgentSession(projectId, "test-model"))!;
  await createProjectCheckpoint(projectId, sessionId);
  await recordAgentAction(sessionId, "user_prompt", { summary: prompt });
  return sessionId;
};

describe.skipIf(!apiEnabled)("version history", () => {
  let owner: TestUser;

  beforeAll(async () => {
    owner = await signUp();
  });

  test("lists versions newest first, with their prompt and file count", async () => {
    const p = await createProject(owner);
    await upsertProjectFile(p.id, "App.tsx", "v1");
    const first = await checkpoint(p.id, "make a todo app");
    await upsertProjectFile(p.id, "util.ts", "export {}");
    const second = await checkpoint(p.id, "add a helper");

    const res = await request("GET", `/projects/${p.id}/checkpoints`, { cookie: owner.cookie });
    expect(res.status).toBe(200);
    expect(res.body.data.map((v: any) => [v.id, v.prompt, v.fileCount])).toEqual([
      [second, "add a helper", 2],
      [first, "make a todo app", 1],
    ]);
  });

  test("fetches a version's files", async () => {
    const p = await createProject(owner);
    await upsertProjectFile(p.id, "App.tsx", "before");
    const id = await checkpoint(p.id, "change it");
    await upsertProjectFile(p.id, "App.tsx", "after");

    const res = await request("GET", `/projects/${p.id}/checkpoints/${id}`, { cookie: owner.cookie });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ "App.tsx": "before" });
  });

  test("restore puts the files back", async () => {
    const p = await createProject(owner);
    await upsertProjectFile(p.id, "App.tsx", "before");
    const id = await checkpoint(p.id, "change it");
    await upsertProjectFile(p.id, "App.tsx", "after");
    await upsertProjectFile(p.id, "extra.ts", "new file");

    const res = await request("POST", `/projects/${p.id}/checkpoints/${id}/restore`, { cookie: owner.cookie });
    expect(res.status).toBe(200);
    const files = await request("GET", `/projects/${p.id}/files`, { cookie: owner.cookie });
    expect(files.body.data).toEqual({ "App.tsx": "before" });
  });

  test("a version from another project is not found", async () => {
    const mine = await createProject(owner);
    const theirs = await createProject(await signUp());
    await upsertProjectFile(theirs.id, "App.tsx", "secret");
    const theirVersion = await checkpoint(theirs.id, "theirs");

    for (const [method, path] of [
      ["GET", `/projects/${mine.id}/checkpoints/${theirVersion}`],
      ["POST", `/projects/${mine.id}/checkpoints/${theirVersion}/restore`],
    ] as const) {
      const res = await request(method, path, { cookie: owner.cookie });
      expect({ path, status: res.status }).toEqual({ path, status: 404 });
    }
  });

  test("a missing or malformed version id is not found", async () => {
    const p = await createProject(owner);
    for (const id of [crypto.randomUUID(), "not-a-uuid"]) {
      for (const [method, path] of [
        ["GET", `/projects/${p.id}/checkpoints/${id}`],
        ["POST", `/projects/${p.id}/checkpoints/${id}/restore`],
      ] as const) {
        const res = await request(method, path, { cookie: owner.cookie });
        expect({ path, status: res.status }).toEqual({ path, status: 404 });
      }
    }
  });
});
