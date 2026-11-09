<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from "svelte";
  import {
    loadSandpackClient,
    type SandpackClient,
    type SandpackBundlerFiles,
    type SandpackTemplate,
  } from "@codesandbox/sandpack-client";
  import {
    currentHeight,
    currentWidth,
    orientation,
    previewScale,
    selectedDevice,
    viewMode,
  } from "$lib/stores/preview";
  import { assembleReactProject } from "$lib/preview/reactAssembler";
  import { activeDesignTemplateCss } from "$lib/stores/agent";
  import FullPageLoader from "$lib/components/FullPageLoader.svelte";
  import warningTriangleIcon from "$lib/assets/icons/warning-triangle.svg?raw";

  export let files: Record<string, string> = {};
  // The runtime client accepts any template string, but SandboxSetup's type only
  // lists the bundler's legacy names, which don't include "react-ts".
  export let template: string = "react-ts";
  $: setupTemplate = template as SandpackTemplate;
  export let framed: boolean = true;
  export let loading: boolean = false;
  export let canFix: boolean = true;

  const dispatch = createEventDispatcher<{ fix: string }>();

  type PreviewError = { title: string; message: string; path?: string; line?: number; column?: number };
  let previewError: PreviewError | null = null;
  let unlisten: (() => void) | null = null;

  const describeError = (e: PreviewError): string => {
    const where = e.path ? `\nat ${e.path}${e.line ? `:${e.line}${e.column ? `:${e.column}` : ""}` : ""}` : "";
    const body = `${e.title}: ${e.message}${where}`;
    return body.length > 2000 ? `${body.slice(0, 2000)}…` : body;
  };

  const fixError = () => {
    if (!previewError) return;
    dispatch("fix", `The preview is showing this error. Find the cause and fix it.\n\n\`\`\`\n${describeError(previewError)}\n\`\`\``);
    previewError = null;
  };

  let iframe: HTMLIFrameElement;
  let client: SandpackClient | null = null;
  let ready = false;

  let canvasW = 0;
  let canvasH = 0;

  $: fillCanvas = $viewMode === "fluid";
  $: deviceW = currentWidth($selectedDevice, $orientation);
  $: deviceH = currentHeight($selectedDevice, $orientation);
  $: scale =
    fillCanvas
      ? 1
      : canvasW > 0 && canvasH > 0
        ? Math.min(1, canvasW / deviceW, canvasH / deviceH)
        : 1;
  $: wrapW = deviceW * scale;
  $: wrapH = deviceH * scale;
  $: previewScale.set(scale);

  const toBundlerFiles = (map: Record<string, string>): SandpackBundlerFiles => {
    const out: SandpackBundlerFiles = {};
    for (const [path, code] of Object.entries(map)) {
      const key = path.startsWith("/") ? path : `/${path}`;
      out[key] = { code };
    }
    return out;
  };

  $: activeFiles =
    Object.keys(files).length > 0
      ? files
      : assembleReactProject({}, { designCss: $activeDesignTemplateCss });

  export const refresh = () => {
    client?.dispatch({ type: "refresh" });
  };

  onMount(async () => {
    client = await loadSandpackClient(
      iframe,
      { files: toBundlerFiles(activeFiles), template: setupTemplate },
      { showOpenInCodeSandbox: false },
    );
    unlisten = client.listen((msg) => {
      if (msg.type === "action" && msg.action === "show-error") {
        previewError = {
          title: msg.title || "Error",
          message: msg.message,
          path: msg.path || undefined,
          line: msg.line || undefined,
          column: msg.column || undefined,
        };
      }
    });
    ready = true;
  });

  onDestroy(() => {
    unlisten?.();
    client?.destroy();
    client = null;
    previewScale.set(1);
  });

  $: if (ready && client) {
    previewError = null;
    client.updateSandbox({ files: toBundlerFiles(activeFiles), template: setupTemplate });
  }
</script>

<div
  class="relative h-full w-full overflow-hidden preview-canvas"
  class:framed
  style="background-color: var(--bg-tertiary);"
>
  <div
    bind:clientWidth={canvasW}
    bind:clientHeight={canvasH}
    class="h-full w-full flex items-center justify-center"
  >
    <div
      class="scale-wrap"
      style={fillCanvas
        ? "width: 100%; height: 100%;"
        : `width: ${wrapW}px; height: ${wrapH}px;`}
    >
      <div
        class="preview-frame overflow-hidden"
        class:framed
        style={fillCanvas
          ? "background-color: #ffffff; width: 100%; height: 100%;"
          : `background-color: #ffffff; width: ${deviceW}px; height: ${deviceH}px; transform: scale(${scale}); transform-origin: top left;`}
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
  </div>
  {#if previewError && !loading}
    <div
      class="absolute left-3 right-3 bottom-3 flex items-center gap-3 px-3 py-2 border rounded-lg text-[12.5px]"
      style="background-color: var(--bg-panel); border-color: var(--border-strong); color: var(--text-primary); box-shadow: var(--panel-shadow);"
      role="alert"
    >
      <span class="w-4 h-4 shrink-0 inline-flex" style="color: var(--danger);">{@html warningTriangleIcon}</span>
      <span class="flex-1 min-w-0 truncate" title={describeError(previewError)}>
        <span class="font-medium">{previewError.title}</span>
        <span style="color: var(--text-secondary);">{previewError.message}</span>
      </span>
      {#if canFix}
        <button
          type="button"
          class="shrink-0 px-2.5 py-1 rounded-md text-[12px] font-medium"
          style="background-color: var(--accent); color: #ffffff;"
          on:click={fixError}
        >
          Fix with agent
        </button>
      {/if}
      <button
        type="button"
        class="shrink-0 text-[12px]"
        style="color: var(--text-secondary);"
        on:click={() => (previewError = null)}
      >
        Dismiss
      </button>
    </div>
  {/if}
  {#if loading}
    <FullPageLoader
      scoped
      rotatingTitles={[
        "Pondering…",
        "Scheming…",
        "Noodling…",
        "Cogitating…",
        "Conjuring…",
        "Brewing…",
        "Weaving…",
        "Hatching…",
        "Simmering…",
        "Puzzling…",
        "Crafting…",
        "Summoning…",
        "Forging…",
        "Mulling…",
      ]}
      subtitle="Waiting for the agent to finish."
    />
  {/if}
</div>

<style>
  .preview-canvas.framed {
    padding: 16px;
  }
  .preview-frame {
    transition:
      width 250ms cubic-bezier(0.22, 0.8, 0.28, 1),
      height 250ms cubic-bezier(0.22, 0.8, 0.28, 1),
      transform 250ms cubic-bezier(0.22, 0.8, 0.28, 1);
  }
  .scale-wrap {
    transition:
      width 250ms cubic-bezier(0.22, 0.8, 0.28, 1),
      height 250ms cubic-bezier(0.22, 0.8, 0.28, 1);
  }
  .preview-frame.framed {
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow:
      0 10px 30px -12px rgba(0, 0, 0, 0.45),
      0 2px 6px -2px rgba(0, 0, 0, 0.35);
  }
</style>
