<script lang="ts">
  import { onMount } from "svelte";
  import {
    messages,
    isRunning,
    providers,
    selectedProvider,
    selectedModel,
    loadProviders,
    sendPrompt,
    cancelAgent,
    previewState,
    restartPreview,
    loadHistory,
    resetWorkspace,
    resumeTurn,
    activePlan,
    todoStatuses,
    planError,
  } from "$lib/stores/agent";
  import PreviewWindow from "$lib/components/PreviewWindow.svelte";
  import AgentPanel from "$lib/components/workspace/AgentPanel.svelte";
  import FloatingControls from "$lib/components/workspace/FloatingControls.svelte";
  import AgentLauncher from "$lib/components/workspace/AgentLauncher.svelte";

  export let projectId: string = "default";

  let panelOpen = true;
  let activeProjectId: string | null = null;

  $: previewUrl = $previewState.state === "ready" ? $previewState.url : "";
  $: statusText =
    $previewState.state === "installing"
      ? "installing…"
      : $previewState.state === "starting"
      ? "starting…"
      : $isRunning
      ? "working…"
      : "idle";
  $: currentProvider = $providers.find((p) => p.name === $selectedProvider);
  $: modelPlaceholder = currentProvider?.defaultModel ?? "";

  onMount(() => {
    loadProviders();
  });

  $: if (projectId && projectId !== activeProjectId) {
    activeProjectId = projectId;
    resetWorkspace();
    loadHistory(projectId).finally(() => {
      resumeTurn(projectId).catch(() => {});
    });
  }

  const handleSubmit = (event: CustomEvent<string>) => {
    if ($isRunning) return;
    sendPrompt(projectId, event.detail);
  };
</script>

<div
  class="relative w-full overflow-hidden"
  style="height: 100vh; background-color: var(--bg-primary); color: var(--text-primary);"
>
  <div
    class="absolute inset-y-0 right-0 overflow-hidden preview-shell"
    style="left: {panelOpen ? 'min(444px, 100%)' : '0px'};"
  >
    <PreviewWindow url={previewUrl} />
  </div>

  <FloatingControls on:restart={() => restartPreview(projectId)} />

  <AgentPanel
    open={panelOpen}
    messages={$messages}
    isRunning={$isRunning}
    providers={$providers}
    bind:selectedProvider={$selectedProvider}
    bind:selectedModel={$selectedModel}
    {modelPlaceholder}
    {statusText}
    plan={$activePlan}
    todoStatuses={$todoStatuses}
    planError={$planError}
    on:close={() => (panelOpen = false)}
    on:submit={handleSubmit}
    on:cancel={cancelAgent}
  />

  <AgentLauncher
    hidden={panelOpen}
    isRunning={$isRunning}
    plan={$activePlan}
    statuses={$todoStatuses}
    planError={$planError}
    on:open={() => (panelOpen = true)}
  />
</div>

<style>
  .preview-shell {
    transition: left 300ms cubic-bezier(0.22, 0.8, 0.28, 1);
  }
</style>
