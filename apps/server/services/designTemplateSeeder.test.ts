import { describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseTemplate, templateToCss } from "./designTemplate";

const TEMPLATES_DIR = resolve(import.meta.dir, "..", "design-templates");

describe("builtin design templates", () => {
  test("every .md file in design-templates/ parses without errors", async () => {
    const files = (await readdir(TEMPLATES_DIR)).filter((f) => f.endsWith(".md"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = await readFile(join(TEMPLATES_DIR, file), "utf8");
      try {
        const parsed = parseTemplate(source);
        expect(parsed.tokens.name).toBeTruthy();
        const css = templateToCss(parsed.tokens);
        expect(css).toContain("@tailwind base;");
      } catch (err) {
        throw new Error(
          `${file} failed to parse: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  });
});
