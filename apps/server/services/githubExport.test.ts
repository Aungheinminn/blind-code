import { describe, expect, test } from "bun:test";
import { assembleGitHubProject } from "./vercelAssembler";

const SUPABASE = {
  url: "https://abcd.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiJ9.anon-key-value",
};

describe("assembleGitHubProject", () => {
  test("emits a runnable project with repo-root paths", () => {
    const out = assembleGitHubProject(
      { "/App.tsx": "export default () => null;" },
      { projectName: "Demo" },
    );
    expect(out["src/App.tsx"]).toBe("export default () => null;");
    expect(out["package.json"]).toContain('"vite"');
    expect(out[".gitignore"]).toContain(".env");
    expect(out["README.md"]).toContain("# Demo");
    expect(Object.keys(out).some((p) => p.startsWith("/"))).toBe(false);
    expect(out[".env.example"]).toBeUndefined();
  });

  test("never inlines the Supabase anon key", () => {
    const out = assembleGitHubProject({}, { projectName: "Demo", supabase: SUPABASE });
    expect(out["src/lib/supabase.ts"]).toContain("import.meta.env.VITE_SUPABASE_URL");
    for (const content of Object.values(out)) {
      expect(content).not.toContain(SUPABASE.anonKey);
    }
    expect(out[".env.example"]).toContain(SUPABASE.url);
  });

  test("drops .env files written by the agent", () => {
    const out = assembleGitHubProject(
      {
        "/.env": "SECRET=1",
        "/.env.local": "SECRET=2",
        "/config/.env.production": "SECRET=3",
        "/env.ts": "export const x = 1;",
      },
      { projectName: "Demo" },
    );
    const all = Object.values(out).join("\n");
    expect(all).not.toContain("SECRET=");
    expect(out["src/env.ts"]).toBe("export const x = 1;");
  });
});
