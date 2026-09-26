import { DEFAULT_APP_TSX, SCAFFOLD_FILES } from "./scaffold";

const BASE_DEPS: Record<string, string> = {
  react: "^18.3.1",
  "react-dom": "^18.3.1",
  clsx: "^2.1.1",
  "tailwind-merge": "^2.6.0",
  "class-variance-authority": "^0.7.1",
  "@radix-ui/react-slot": "^1.1.0",
  "@radix-ui/react-label": "^2.1.0",
  "@tailwindcss/browser": "^4.1.0",
};

const BASE_DEV_DEPS: Record<string, string> = {
  "@types/react": "^18.3.12",
  "@types/react-dom": "^18.3.1",
  typescript: "^5.5.0",
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

const RESERVED_PATHS = new Set([
  "package.json",
  "/package.json",
  "tsconfig.json",
  "/tsconfig.json",
  "index.tsx",
  "/index.tsx",
  "styles.css",
  "/styles.css",
]);

const normalizePath = (raw: string): string => {
  const withSlash = raw.startsWith("/") ? raw : `/${raw}`;
  // Strip a legacy /src/ prefix the agent may still emit — classic-bundler
  // template expects files at root.
  if (withSlash.startsWith("/src/")) {
    return withSlash.slice(4);
  }
  return withSlash;
};

export type SupabaseInject = {
  url: string;
  anonKey: string;
};

export type AssembleOptions = {
  supabase?: SupabaseInject | null;
  designCss?: string | null;
};

const escapeJsString = (v: string) => v.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

const generateSupabaseClient = (s: SupabaseInject): string =>
  `import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "${escapeJsString(s.url)}",
  "${escapeJsString(s.anonKey)}",
);
`;

export const assembleReactProject = (
  raw: Record<string, string>,
  opts: AssembleOptions = {},
): Record<string, string> => {
  const files: Record<string, string> = { ...SCAFFOLD_FILES };

  if (opts.designCss) {
    files["/styles.css"] = opts.designCss;
  }

  for (const [path, content] of Object.entries(raw)) {
    if (!path) continue;
    if (RESERVED_PATHS.has(path)) continue;
    files[normalizePath(path)] = content;
  }

  if (
    !files["/App.tsx"] &&
    !files["/App.jsx"] &&
    !files["/App.js"] &&
    !files["/App.ts"]
  ) {
    files["/App.tsx"] = DEFAULT_APP_TSX;
  }

  if (opts.supabase) {
    files["/lib/supabase.ts"] = generateSupabaseClient(opts.supabase);
  }

  const detected = detectDeps(files);
  if (opts.supabase) {
    detected["@supabase/supabase-js"] =
      VERSION_HINTS["@supabase/supabase-js"] ?? "^2.45.0";
  }

  files["/package.json"] = JSON.stringify(
    {
      name: "vibe-preview",
      private: true,
      version: "0.0.0",
      dependencies: { ...BASE_DEPS, ...detected },
      devDependencies: BASE_DEV_DEPS,
    },
    null,
    2,
  );

  return files;
};
