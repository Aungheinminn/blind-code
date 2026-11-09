import { describe, expect, test } from "bun:test";
import { resolveAgentToolPermissions } from "@vibe/shared";
import { applyEdit, buildCoderTools, buildSearchPattern, searchLines } from "./tools";

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

describe("applyEdit", () => {
  test("replaces a unique match", () => {
    const r = applyEdit("a\nb\nc", "b", "B");
    expect(r).toEqual({ ok: true, content: "a\nB\nc", replacements: 1 });
  });

  test("rejects a missing match", () => {
    expect(applyEdit("abc", "x", "y").ok).toBe(false);
  });

  test("rejects an ambiguous match unless replace_all", () => {
    expect(applyEdit("x x", "x", "y").ok).toBe(false);
    expect(applyEdit("x x", "x", "y", true)).toEqual({ ok: true, content: "y y", replacements: 2 });
  });

  test("keeps replacement patterns literal", () => {
    const r = applyEdit("price", "price", "$& $1");
    expect(r.ok && r.content).toBe("$& $1");
  });

  test("rejects empty and no-op edits", () => {
    expect(applyEdit("abc", "", "x").ok).toBe(false);
    expect(applyEdit("abc", "a", "a").ok).toBe(false);
  });

  test("is offered to the coder", () => {
    expect("edit_file" in buildCoderTools(ctx, {})).toBe(true);
  });
});

describe("search helpers", () => {
  test("literal queries escape regex characters", () => {
    const p = buildSearchPattern("a.b(", {});
    expect(p instanceof RegExp && p.test("xa.b(y")).toBe(true);
    expect(p instanceof RegExp && p.test("axb(")).toBe(false);
  });

  test("case-insensitive by default", () => {
    const p = buildSearchPattern("Header", {}) as RegExp;
    expect(p.test("<header>")).toBe(true);
    const strict = buildSearchPattern("Header", { caseSensitive: true }) as RegExp;
    expect(strict.test("<header>")).toBe(false);
  });

  test("invalid regex returns an error", () => {
    expect(buildSearchPattern("(", { regex: true })).toHaveProperty("error");
  });

  test("searchLines reports 1-based lines and respects the limit", () => {
    const content = "foo\nbar foo\nbaz\nfoo";
    const p = buildSearchPattern("foo", {}) as RegExp;
    expect(searchLines("a.ts", content, p, 10).map((m) => m.line)).toEqual([1, 2, 4]);
    expect(searchLines("a.ts", content, p, 2)).toHaveLength(2);
  });
});
