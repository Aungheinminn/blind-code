<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import {
    loadSandpackClient,
    type SandpackClient,
    type SandpackBundlerFiles,
    type SandpackTemplate,
  } from "@codesandbox/sandpack-client";

  export let files: Record<string, string> = {};
  export let template: SandpackTemplate = "create-react-app-typescript";
  export let framed: boolean = true;

  let iframe: HTMLIFrameElement;
  let client: SandpackClient | null = null;
  let ready = false;

  const STARTER_FILES: Record<string, string> = {
    "/public/index.html": `<!DOCTYPE html>
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
`,
    "/index.tsx": `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

const root = createRoot(document.getElementById("root")!);
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`,
    "/App.tsx": `import { useState } from "react";

export default function App() {
  const [count, setCount] = useState(0);
  return (
    <main>
      <h1>Hello from Sandpack + React 19</h1>
      <p>Ask the agent to build something.</p>
      <button onClick={() => setCount((c) => c + 1)}>
        Clicked {count} times
      </button>
    </main>
  );
}
`,
    "/styles.css": `:root { color-scheme: light; }
body {
  margin: 0;
  font-family: system-ui, sans-serif;
  color: #1a1a1a;
}
main { padding: 2rem; }
h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
p { color: #666; margin: 0 0 1rem; }
button {
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  border: 1px solid #d4d4d4;
  background: white;
  cursor: pointer;
}
`,
    "/tsconfig.json": JSON.stringify(
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
    ),
    "/package.json": JSON.stringify(
      {
        main: "/index.tsx",
        dependencies: {
          react: "^19.0.0",
          "react-dom": "^19.0.0",
          "react-scripts": "^4.0.0",
        },
        devDependencies: {
          "@types/react": "^19.0.0",
          "@types/react-dom": "^19.0.0",
          typescript: "^4.0.0",
        },
      },
      null,
      2,
    ),
  };

  const toBundlerFiles = (map: Record<string, string>): SandpackBundlerFiles => {
    const out: SandpackBundlerFiles = {};
    for (const [path, code] of Object.entries(map)) {
      const key = path.startsWith("/") ? path : `/${path}`;
      out[key] = { code };
    }
    return out;
  };

  const currentFiles = (): Record<string, string> =>
    Object.keys(files).length > 0 ? files : STARTER_FILES;

  export const refresh = () => {
    client?.dispatch({ type: "refresh" });
  };

  onMount(async () => {
    client = await loadSandpackClient(
      iframe,
      { files: toBundlerFiles(currentFiles()), template },
      { showOpenInCodeSandbox: false },
    );
    ready = true;
  });

  onDestroy(() => {
    client?.destroy();
    client = null;
  });

  $: if (ready && client) {
    client.updateSandbox({ files: toBundlerFiles(currentFiles()), template });
  }
</script>

<div
  class="h-full w-full flex preview-canvas"
  class:framed
  style="background-color: var(--bg-primary);"
>
  <div
    class="flex-1 min-w-0 min-h-0 overflow-hidden preview-frame"
    class:framed
    style="background-color: #ffffff;"
  >
    <iframe
      bind:this={iframe}
      class="h-full w-full border-0 block"
      title="Preview"
      allow="accelerometer; camera; encrypted-media; geolocation; gyroscope; microphone; midi; clipboard-read; clipboard-write"
      sandbox="allow-forms allow-modals allow-pointer-lock allow-popups allow-presentation allow-same-origin allow-scripts"
    ></iframe>
  </div>
</div>

<style>
  .preview-canvas.framed {
    padding: 16px;
  }
  .preview-frame.framed {
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow:
      0 10px 30px -12px rgba(0, 0, 0, 0.45),
      0 2px 6px -2px rgba(0, 0, 0, 0.35);
  }
</style>
