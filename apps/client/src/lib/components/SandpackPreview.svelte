<script lang="ts">
  import { onMount, onDestroy } from "svelte";
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
  import FullPageLoader from "$lib/components/FullPageLoader.svelte";

  export let files: Record<string, string> = {};
  export let template: SandpackTemplate = "react-ts";
  export let framed: boolean = true;
  export let loading: boolean = false;

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
    Object.keys(files).length > 0 ? files : assembleReactProject({});

  export const refresh = () => {
    client?.dispatch({ type: "refresh" });
  };

  onMount(async () => {
    client = await loadSandpackClient(
      iframe,
      { files: toBundlerFiles(activeFiles), template },
      { showOpenInCodeSandbox: false },
    );
    ready = true;
  });

  onDestroy(() => {
    client?.destroy();
    client = null;
    previewScale.set(1);
  });

  $: if (ready && client) {
    client.updateSandbox({ files: toBundlerFiles(activeFiles), template });
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
  {#if loading}
    <FullPageLoader
      scoped
      title="Working…"
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
