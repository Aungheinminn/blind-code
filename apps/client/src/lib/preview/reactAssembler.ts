const BASE_DEPS: Record<string, string> = {
  react: "^19.0.0",
  "react-dom": "^19.0.0",
  "react-scripts": "^4.0.0",
};

const BASE_DEV_DEPS: Record<string, string> = {
  "@types/react": "^19.0.0",
  "@types/react-dom": "^19.0.0",
  typescript: "^4.0.0",
};

const VERSION_HINTS: Record<string, string> = {
  "lucide-react": "^0.454.0",
  clsx: "^2.1.1",
  "tailwind-merge": "^2.6.0",
  "class-variance-authority": "^0.7.1",
  "framer-motion": "^11.15.0",
  "date-fns": "^4.1.0",
  zustand: "^5.0.2",
  axios: "^1.7.9",
  recharts: "^2.15.0",
  "react-router-dom": "^7.1.1",
};

const IMPORT_RE =
  /(?:import\s+(?:[^'"`;]+?\s+from\s+)?['"]([^'"`]+)['"]|require\s*\(\s*['"]([^'"`]+)['"]\s*\))/g;

const isBarePackage = (spec: string): boolean =>
  !!spec && !spec.startsWith(".") && !spec.startsWith("/") && !spec.startsWith("http");

const packageNameOf = (spec: string): string => {
  const parts = spec.split("/");
  if (spec.startsWith("@") && parts.length >= 2) return `${parts[0]}/${parts[1]}`;
  return parts[0];
};

const detectDeps = (files: Record<string, string>): Record<string, string> => {
  const deps: Record<string, string> = {};
  for (const [path, content] of Object.entries(files)) {
    if (!/\.(tsx?|jsx?|mjs)$/.test(path)) continue;
    IMPORT_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = IMPORT_RE.exec(content))) {
      const spec = m[1] || m[2];
      if (!spec || !isBarePackage(spec)) continue;
      const name = packageNameOf(spec);
      if (name === "react" || name === "react-dom") continue;
      if (name.startsWith("react-dom/")) continue;
      if (deps[name]) continue;
      deps[name] = VERSION_HINTS[name] ?? "latest";
    }
  }
  return deps;
};

const normalizePath = (raw: string): string => {
  let p = raw.startsWith("/") ? raw.slice(1) : raw;
  if (p.startsWith("src/")) p = p.slice(4);
  return `/${p}`;
};

const DEFAULT_APP = `export default function App() {
  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>Preview</h1>
      <p>Waiting for the agent to write App.tsx…</p>
    </main>
  );
}
`;

const DEFAULT_INDEX_TSX = `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

const root = createRoot(document.getElementById("root")!);
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`;

const DEFAULT_INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Preview</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;

const DEFAULT_STYLES_CSS = `:root { color-scheme: light; }
body { margin: 0; font-family: system-ui, sans-serif; color: #1a1a1a; }
`;

const DEFAULT_TSCONFIG = JSON.stringify(
  {
    include: ["./**/*"],
    compilerOptions: {
      strict: true,
      esModuleInterop: true,
      lib: ["dom", "es2015"],
      jsx: "react-jsx",
    },
  },
  null,
  2,
);

export const assembleReactProject = (
  raw: Record<string, string>,
): Record<string, string> => {
  const files: Record<string, string> = {};
  for (const [path, content] of Object.entries(raw)) {
    if (!path) continue;
    if (path === "package.json" || path === "/package.json") continue;
    if (path === "tsconfig.json" || path === "/tsconfig.json") continue;
    files[normalizePath(path)] = content;
  }

  if (!files["/App.tsx"] && !files["/App.jsx"] && !files["/App.js"] && !files["/App.ts"]) {
    files["/App.tsx"] = DEFAULT_APP;
  }
  if (!files["/index.tsx"] && !files["/index.jsx"] && !files["/index.js"]) {
    files["/index.tsx"] = DEFAULT_INDEX_TSX;
  }
  if (!files["/public/index.html"]) {
    files["/public/index.html"] = DEFAULT_INDEX_HTML;
  }
  if (!files["/styles.css"]) {
    files["/styles.css"] = DEFAULT_STYLES_CSS;
  }

  const detected = detectDeps(files);
  files["/tsconfig.json"] = DEFAULT_TSCONFIG;
  files["/package.json"] = JSON.stringify(
    {
      main: "/index.tsx",
      dependencies: { ...BASE_DEPS, ...detected },
      devDependencies: BASE_DEV_DEPS,
    },
    null,
    2,
  );

  return files;
};
