<script lang="ts">
  import { onMount } from "svelte";
  import { get } from "svelte/store";
  import { goto } from "$app/navigation";
  import {
    messages,
    isRunning,
    providers,
    selectedProvider,
    selectedModel,
    loadProviders,
    sendPrompt,
    cancelAgent,
    retryLastPrompt,
    loadHistory,
    loadProjectFiles,
    resetWorkspace,
    resumeTurn,
    activePlan,
    todoStatuses,
    planError,
    assembledFiles,
    projectFiles,
  } from "$lib/stores/agent";
  import SandpackPreview from "$lib/components/SandpackPreview.svelte";
  import AgentPanel from "$lib/components/workspace/AgentPanel.svelte";
  import PreviewHeader from "$lib/components/workspace/PreviewHeader.svelte";
  import AgentLauncher from "$lib/components/workspace/AgentLauncher.svelte";
  import { getProject } from "$lib/api/projects";
  import { orientation, selectedDevice } from "$lib/stores/preview";

  const openAgentPanel = () => {
    panelOpen = true;
    selectedDevice.set("laptop");
    orientation.set("portrait");
  };

  const PENDING_PROMPT_PREFIX = "vibe-pending-prompt:";

  export let projectId: string = "default";

  let panelOpen = true;
  let launcherHidden = false;
  let activeProjectId: string | null = null;
  let sandpack: SandpackPreview | undefined;
  let projectName = "";

  $: statusText = $isRunning ? "working…" : "idle";
  $: currentProvider = $providers.find((p) => p.name === $selectedProvider);
  $: modelPlaceholder = currentProvider?.defaultModel ?? "";
  $: hasUserApp = Object.keys($projectFiles).some((p) =>
    /^\/?App\.(tsx|jsx|ts|js)$/.test(p),
  );
  $: previewLoading = $isRunning && !hasUserApp;

  onMount(() => {
    loadProviders();
  });

  const readPendingPrompt = (id: string): string => {
    try {
      const val = sessionStorage.getItem(PENDING_PROMPT_PREFIX + id) ?? "";
      if (val) sessionStorage.removeItem(PENDING_PROMPT_PREFIX + id);
      return val;
    } catch {
      return "";
    }
  };

  const consumePendingPrompt = async (id: string, pending: string) => {
    if (!pending) return;
    if (activeProjectId !== id) return;
    const nonWelcome = get(messages).filter((m) => m.id !== "welcome");
    if (nonWelcome.length > 0) return;
    if (get(isRunning)) return;
    if (!get(selectedProvider)) return;
    sendPrompt(id, pending);
  };

  const bootstrapProject = async (id: string, pending: string) => {
    await Promise.all([
      loadHistory(id).catch(() => {}),
      loadProjectFiles(id).catch(() => {}),
      resumeTurn(id).catch(() => {}),
      get(providers).length === 0 ? loadProviders().catch(() => {}) : Promise.resolve(),
    ]);
    if (activeProjectId !== id) return;
    await consumePendingPrompt(id, pending);
  };

  $: if (projectId && projectId !== activeProjectId) {
    activeProjectId = projectId;
    projectName = "";
    resetWorkspace();
    const pending = readPendingPrompt(projectId);
    bootstrapProject(projectId, pending);
    getProject(projectId)
      .then((p) => {
        if (p && activeProjectId === projectId) projectName = p.name;
      })
      .catch(() => {});
  }

  const handleSubmit = (event: CustomEvent<string>) => {
    if ($isRunning) return;
    sendPrompt(projectId, event.detail);
  };

  const goBack = () => {
    goto("/projects");
  };
</script>

<div
  class="relative w-full overflow-hidden"
  style="height: 100vh; background-color: var(--bg-primary); color: var(--text-primary);"
>
  <div
    class="absolute inset-y-0 right-0 overflow-hidden preview-shell flex flex-col"
    style="left: {panelOpen ? 'min(444px, 100%)' : '0px'};"
  >
    <PreviewHeader
      {panelOpen}
      {launcherHidden}
      on:restart={() => sandpack?.refresh()}
      on:toggle-launcher={() => (launcherHidden = !launcherHidden)}
    />
    <div class="flex-1 min-h-0 relative">
      <SandpackPreview
        bind:this={sandpack}
        files={$assembledFiles}
        framed={panelOpen}
        loading={previewLoading}
      />
    </div>
  </div>

  <AgentPanel
    open={panelOpen}
    {projectId}
    {projectName}
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
    on:retry={() => retryLastPrompt(projectId)}
    on:back={goBack}
  />

  <AgentLauncher
    hidden={panelOpen || launcherHidden}
    isRunning={$isRunning}
    plan={$activePlan}
    statuses={$todoStatuses}
    planError={$planError}
    on:open={openAgentPanel}
  />
</div>

<style>
  .preview-shell {
    transition: left 300ms cubic-bezier(0.22, 0.8, 0.28, 1);
  }
</style>
