import { describe, expect, test } from "bun:test";
import { diffFileSets, diffLines, toHunks } from "./diff";

describe("diffLines", () => {
  test("marks added and removed lines", () => {
    const d = diffLines("a\nb\nc\n", "a\nx\nc\n")!;
    expect(d.map((l) => `${l.kind}:${l.text}`)).toEqual(["same:a", "del:b", "add:x", "same:c"]);
  });

  test("handles empty sides", () => {
    expect(diffLines("", "a\n")!.map((l) => l.kind)).toEqual(["add"]);
    expect(diffLines("a", "")!.map((l) => l.kind)).toEqual(["del"]);
  });

  test("gives up on huge rewrites", () => {
    const big = (p: string) => Array.from({ length: 3000 }, (_, i) => `${p}${i}`).join("\n");
    expect(diffLines(big("a"), big("b"))).toBeNull();
  });
});

describe("diffFileSets", () => {
  test("classifies files and counts lines", () => {
    const changes = diffFileSets(
      { "App.tsx": "a\nb\n", "old.ts": "x\ny\n", "same.ts": "s" },
      { "App.tsx": "a\nc\nd\n", "new.ts": "n\n", "same.ts": "s" },
    );
    expect(changes).toEqual([
      { path: "App.tsx", status: "changed", added: 2, removed: 1 },
      { path: "new.ts", status: "added", added: 1, removed: 0 },
      { path: "old.ts", status: "removed", added: 0, removed: 2 },
    ]);
  });
});

describe("toHunks", () => {
  test("collapses unchanged runs outside the context", () => {
    const before = Array.from({ length: 20 }, (_, i) => `l${i}`).join("\n");
    const after = before.replace("l10", "changed");
    const hunks = toHunks(diffLines(before, after)!, 2);
    expect(hunks.length).toBe(1);
    expect(hunks[0].skippedBefore).toBe(8);
    expect(hunks[0].lines.map((l) => l.text)).toEqual(["l8", "l9", "l10", "changed", "l11", "l12"]);
  });
});
