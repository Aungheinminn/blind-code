import { describe, expect, test } from "bun:test";
import { resolveAgentToolPermissions } from "@vibe/shared";
import { buildCoderTools } from "./tools";

const ctx = { sandboxProjectId: "p", dbProjectId: "p", ownerId: "u" };

describe("buildCoderTools GitHub gating", () => {
  test("GitHub tools are off by default even when connected", () => {
    const tools = buildCoderTools(
      { ...ctx, githubConnected: true },
      resolveAgentToolPermissions(null),
    );
    expect("github_push" in tools).toBe(false);
    expect("github_create_repo" in tools).toBe(false);
    expect("create_supabase_project" in tools).toBe(true);
  });

  test("enabled per project when the account is connected", () => {
    const tools = buildCoderTools(
      { ...ctx, githubConnected: true },
      resolveAgentToolPermissions({ github_push: true, github_create_repo: true }),
    );
    expect("github_push" in tools).toBe(true);
    expect("github_create_repo" in tools).toBe(true);
  });

  test("hidden when the account isn't connected", () => {
    const tools = buildCoderTools(
      { ...ctx, githubConnected: false },
      resolveAgentToolPermissions({ github_push: true, github_create_repo: true }),
    );
    expect("github_push" in tools).toBe(false);
    expect("github_create_repo" in tools).toBe(false);
  });

  test("a partial permissions object doesn't enable them", () => {
    const tools = buildCoderTools({ ...ctx, githubConnected: true }, {});
    expect("github_push" in tools).toBe(false);
  });
});
