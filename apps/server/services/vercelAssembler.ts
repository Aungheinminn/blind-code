import {
  LIB_UTILS_TS,
  STYLES_CSS,
  UI_ALERT_DIALOG_TSX,
  UI_BUTTON_TSX,
  UI_CARD_TSX,
  UI_DIALOG_TSX,
  UI_INPUT_TSX,
  UI_LABEL_TSX,
} from "@vibe/shared/preview/scaffold";

const BASE_DEPS: Record<string, string> = {
  react: "^18.3.1",
  "react-dom": "^18.3.1",
  clsx: "^2.1.1",
  "tailwind-merge": "^2.6.0",
  "class-variance-authority": "^0.7.1",
  "@radix-ui/react-slot": "^1.1.0",
  "@radix-ui/react-label": "^2.1.0",
  "@radix-ui/react-dialog": "^1.1.0",
  "@radix-ui/react-alert-dialog": "^1.1.0",
  "lucide-react": "^0.454.0",
};

const BASE_DEV_DEPS: Record<string, string> = {
  "@types/react": "^18.3.12",
  "@types/react-dom": "^18.3.1",
  typescript: "^5.5.0",
  vite: "^5.4.10",
  "@vitejs/plugin-react": "^4.3.3",
  tailwindcss: "^4.1.0",
  "@tailwindcss/vite": "^4.1.0",
};

const VERSION_HINTS: Record<string, string> = {
  "lucide-react": "^0.454.0",
  "framer-motion": "^11.15.0",
  "date-fns": "^4.1.0",
  zustand: "^5.0.2",
  axios: "^1.7.9",
  recharts: "^2.15.0",
  "react-router-dom": "^7.1.1",
  "@supabase/supabase-js": "^2.45.0",
};

const IMPORT_RE =
  /(?:import\s+(?:[^'"`;]+?\s+from\s+)?['"]([^'"`]+)['"]|require\s*\(\s*['"]([^'"`]+)['"]\s*\))/g;

const isBarePackage = (spec: string): boolean =>
  !!spec &&
  !spec.startsWith(".") &&
  !spec.startsWith("/") &&
  !spec.startsWith("@/") &&
  !spec.startsWith("http");

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
      if (name in BASE_DEPS) continue;
      if (name === "react-dom" || name.startsWith("react-dom/")) continue;
      if (deps[name]) continue;
      deps[name] = VERSION_HINTS[name] ?? "latest";
    }
  }
  return deps;
};

const RESERVED_SOURCE_PATHS = new Set([
  "package.json",
  "/package.json",
  "tsconfig.json",
  "/tsconfig.json",
  "index.tsx",
  "/index.tsx",
  "index.html",
  "/index.html",
  "vite.config.ts",
  "/vite.config.ts",
]);

const toSrcPath = (raw: string): string => {
  const withSlash = raw.startsWith("/") ? raw : `/${raw}`;
  const stripped = withSlash.startsWith("/src/") ? withSlash.slice(4) : withSlash;
  return `/src${stripped}`;
};

export type SupabaseInject = {
  url: string;
  anonKey: string;
};

export type VercelAssembleOptions = {
  supabase?: SupabaseInject | null;
  designCss?: string | null;
  // Read the Supabase URL/key from Vite env vars instead of inlining them,
  // for exports that end up in a git repository.
  supabaseFromEnv?: boolean;
};

const escapeJsString = (v: string) =>
  v.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

const generateSupabaseClient = (s: SupabaseInject): string =>
  `import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "${escapeJsString(s.url)}",
  "${escapeJsString(s.anonKey)}",
);
`;

const SUPABASE_ENV_CLIENT = `import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
`;

const DEFAULT_APP_TSX = `export default function App() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Hello from your deployed app</h1>
        <p className="mt-2 text-sm opacity-70">Edit App.tsx and redeploy to see changes.</p>
      </div>
    </main>
  );
}
`;

const INDEX_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

const MAIN_TSX = `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`;

const VITE_CONFIG_TS = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
`;

const TAILWIND_PRELUDE = `@import "tailwindcss";

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius: var(--radius);
}

/* Tailwind v4 preflight sets \`cursor: default\` on buttons. Restore the
   v3 pointer-cursor behavior so deployed apps feel clickable without
   relying on the user to add \`cursor-pointer\` everywhere. Kept in the
   prelude so it applies regardless of any design-CSS override of
   /src/styles.css. */
@layer base {
  button:not(:disabled),
  [role="button"]:not(:disabled) {
    cursor: pointer;
  }
}

`;

const TSCONFIG_JSON = JSON.stringify(
  {
    compilerOptions: {
      target: "ES2020",
      module: "ESNext",
      moduleResolution: "bundler",
      jsx: "react-jsx",
      strict: false,
      esModuleInterop: true,
      skipLibCheck: true,
      resolveJsonModule: true,
      isolatedModules: true,
      noEmit: true,
      allowImportingTsExtensions: false,
      lib: ["ES2020", "DOM", "DOM.Iterable"],
    },
    include: ["src"],
  },
  null,
  2,
);

export const assembleVercelProject = (
  raw: Record<string, string>,
  opts: VercelAssembleOptions = {},
): Record<string, string> => {
  const files: Record<string, string> = {};

  for (const [path, content] of Object.entries(raw)) {
    if (!path) continue;
    if (RESERVED_SOURCE_PATHS.has(path)) continue;
    files[toSrcPath(path)] = content;
  }

  if (
    !files["/src/App.tsx"] &&
    !files["/src/App.jsx"] &&
    !files["/src/App.js"] &&
    !files["/src/App.ts"]
  ) {
    files["/src/App.tsx"] = DEFAULT_APP_TSX;
  }

  const userStyles =
    opts.designCss ?? files["/src/styles.css"] ?? STYLES_CSS;
  files["/src/styles.css"] = TAILWIND_PRELUDE + userStyles;

  if (!files["/src/lib/utils.ts"]) {
    files["/src/lib/utils.ts"] = LIB_UTILS_TS;
  }
  if (!files["/src/components/ui/button.tsx"]) {
    files["/src/components/ui/button.tsx"] = UI_BUTTON_TSX;
  }
  if (!files["/src/components/ui/card.tsx"]) {
    files["/src/components/ui/card.tsx"] = UI_CARD_TSX;
  }
  if (!files["/src/components/ui/input.tsx"]) {
    files["/src/components/ui/input.tsx"] = UI_INPUT_TSX;
  }
  if (!files["/src/components/ui/label.tsx"]) {
    files["/src/components/ui/label.tsx"] = UI_LABEL_TSX;
  }
  if (!files["/src/components/ui/dialog.tsx"]) {
    files["/src/components/ui/dialog.tsx"] = UI_DIALOG_TSX;
  }
  if (!files["/src/components/ui/alert-dialog.tsx"]) {
    files["/src/components/ui/alert-dialog.tsx"] = UI_ALERT_DIALOG_TSX;
  }

  if (opts.supabase) {
    files["/src/lib/supabase.ts"] = opts.supabaseFromEnv
      ? SUPABASE_ENV_CLIENT
      : generateSupabaseClient(opts.supabase);
  }

  files["/index.html"] = INDEX_HTML;
  files["/src/main.tsx"] = MAIN_TSX;
  files["/vite.config.ts"] = VITE_CONFIG_TS;
  files["/tsconfig.json"] = TSCONFIG_JSON;

  const detected = detectDeps(files);
  if (opts.supabase) {
    detected["@supabase/supabase-js"] =
      VERSION_HINTS["@supabase/supabase-js"] ?? "^2.45.0";
  }

  files["/package.json"] = JSON.stringify(
    {
      name: "blind-app",
      private: true,
      version: "0.0.0",
      type: "module",
      scripts: {
        dev: "vite",
        build: "vite build",
        preview: "vite preview",
      },
      dependencies: { ...BASE_DEPS, ...detected },
      devDependencies: BASE_DEV_DEPS,
    },
    null,
    2,
  );

  return files;
};

const ENV_FILE_RE = /(^|\/)\.env(\.[^/]*)?$/;

const GITIGNORE = `node_modules
dist
.env
.env.*
!.env.example
.DS_Store
`;

const githubReadme = (name: string, hasSupabase: boolean): string => {
  const envSection = hasSupabase
    ? `
## Environment

Copy \`.env.example\` to \`.env\` and fill in the anon key from your Supabase
project (Project Settings → API).
`
    : "";
  return `# ${name}

Built with Blind Code.

## Run locally

\`\`\`bash
npm install
npm run dev
\`\`\`
${envSection}`;
};

export type GitHubAssembleOptions = {
  projectName: string;
  supabase?: SupabaseInject | null;
  designCss?: string | null;
};

// Same runnable Vite project as the Vercel export, minus anything secret,
// with repo-root paths (no leading slash) as the Git Data API expects.
export const assembleGitHubProject = (
  raw: Record<string, string>,
  opts: GitHubAssembleOptions,
): Record<string, string> => {
  const safeRaw: Record<string, string> = {};
  for (const [path, content] of Object.entries(raw)) {
    if (ENV_FILE_RE.test(path)) continue;
    safeRaw[path] = content;
  }
  const assembled = assembleVercelProject(safeRaw, {
    supabase: opts.supabase,
    designCss: opts.designCss,
    supabaseFromEnv: true,
  });
  const out: Record<string, string> = {};
  for (const [path, content] of Object.entries(assembled)) {
    out[path.replace(/^\/+/, "")] = content;
  }
  out[".gitignore"] = GITIGNORE;
  out["src/vite-env.d.ts"] ??= `/// <reference types="vite/client" />\n`;
  out["README.md"] = githubReadme(opts.projectName, Boolean(opts.supabase));
  if (opts.supabase) {
    out[".env.example"] =
      `VITE_SUPABASE_URL=${opts.supabase.url}\nVITE_SUPABASE_ANON_KEY=your-anon-key\n`;
  }
  return out;
};
