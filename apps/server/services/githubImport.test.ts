import { describe, expect, test } from "bun:test";
import { IMPORT_LIMITS, planImport, stripExportPrelude, toProjectFile } from "./githubImport";
import { assembleGitHubProject, TAILWIND_PRELUDE } from "./vercelAssembler";
import type { GitTreeItem } from "./githubManagement";

const blob = (path: string, size = 100): GitTreeItem => ({ path, type: "blob", sha: path, size });
const paths = (tree: GitTreeItem[]) => planImport(tree).files.map((f) => f.projectPath).sort();

describe("planImport", () => {
  test("flattens src/ and drops what the export generates", () => {
    const tree = [
      blob("package.json"),
      blob("index.html"),
      blob("vite.config.ts"),
      blob("README.md"),
      blob(".gitignore"),
      blob("src/main.tsx"),
      blob("src/vite-env.d.ts"),
      blob("src/App.tsx"),
      blob("src/styles.css"),
      blob("src/components/Header.tsx"),
      { path: "src/components", type: "tree", sha: "t" } as GitTreeItem,
    ];
    expect(paths(tree)).toEqual(["App.tsx", "components/Header.tsx", "styles.css"]);
  });

  test("imports from the root when there's no src/", () => {
    const tree = [blob("App.tsx"), blob("package.json"), blob("lib/util.ts"), blob("tsconfig.node.json")];
    expect(paths(tree)).toEqual(["App.tsx", "lib/util.ts"]);
  });

  test("skips hidden, vendored, binary-type and oversized files", () => {
    const tree = [
      blob("src/App.tsx"),
      blob("src/.env"),
      blob("src/.storybook/x.ts"),
      blob("src/node_modules/x/index.js"),
      blob("src/logo.png"),
      blob("src/huge.json", IMPORT_LIMITS.maxFileBytes + 1),
    ];
    const plan = planImport(tree);
    expect(plan.files.map((f) => f.projectPath)).toEqual(["App.tsx"]);
    expect(plan.skipped).toBe(2);
  });

  test("caps the number of files", () => {
    const tree = Array.from({ length: IMPORT_LIMITS.maxFiles + 5 }, (_, i) => blob(`src/f${i}.ts`, 10));
    const plan = planImport(tree);
    expect(plan.files.length).toBe(IMPORT_LIMITS.maxFiles);
    expect(plan.skipped).toBe(5);
  });
});

describe("stripExportPrelude", () => {
  test("removes the Tailwind prelude the export adds", () => {
    expect(stripExportPrelude(TAILWIND_PRELUDE + ".a{}")).toBe(".a{}");
    expect(stripExportPrelude(".a{}")).toBe(".a{}");
  });
});

describe("export round trip", () => {
  test("importing an exported project gives back its files", () => {
    const project = {
      "App.tsx": "import { Header } from './components/Header';\nexport default function App() { return <Header />; }\n",
      "components/Header.tsx": "export const Header = () => <h1>Hi</h1>;\n",
      "styles.css": ":root { --brand: red; }\n",
    };
    const exported = assembleGitHubProject(project, { projectName: "demo" });
    const tree = Object.entries(exported).map(([path, content]) => blob(path, content.length));
    const imported: Record<string, string> = {};
    for (const f of planImport(tree).files) {
      const content = toProjectFile(f.projectPath, exported[f.repoPath]);
      if (content !== null) imported[f.projectPath] = content;
    }
    expect(imported).toEqual(project);
  });
});
