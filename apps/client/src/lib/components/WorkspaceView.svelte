<script lang="ts">
  import { onMount } from "svelte";
  import { get } from "svelte/store";
  import { goto } from "$app/navigation";
  import {
    messages,
    isRunning,
    providers,
    selectedModel,
    loadProviders,
    sendPrompt,
    cancelAgent,
    retryLastPrompt,
    loadHistory,
    loadProjectFiles,
    loadDesignTemplate,
    resetWorkspace,
    resumeTurn,
    activePlan,
    todoStatuses,
    planError,
    assembledFiles,
    projectFiles,
    projectIntegration,
    projectVercel,
  } from "$lib/stores/agent";
  import SandpackPreview from "$lib/components/SandpackPreview.svelte";
  import AgentPanel from "$lib/components/workspace/AgentPanel.svelte";
  import PreviewHeader from "$lib/components/workspace/PreviewHeader.svelte";
  import AgentLauncher from "$lib/components/workspace/AgentLauncher.svelte";
  import PlanningPane from "$lib/components/workspace/PlanningPane.svelte";
  import SupabaseConnectModal from "$lib/components/workspace/SupabaseConnectModal.svelte";
  import DeployModal from "$lib/components/workspace/DeployModal.svelte";
  import { checkVercelDeploymentStatus, getProject } from "$lib/api/projects";
  import { orientation, viewMode } from "$lib/stores/preview";

  const openAgentPanel = () => {
    panelOpen = true;
    viewMode.set("fluid");
    orientation.set("portrait");
  };

  const PENDING_PROMPT_PREFIX = "vibe-pending-prompt:";

  export let projectId: string = "default";

  let panelOpen = true;
  let launcherHidden = false;
  let activeProjectId: string | null = null;
  let sandpack: SandpackPreview | undefined;
  let projectName = "";
  let supabaseModalOpen = false;
  let deployModalOpen = false;
  // One-way latch per project: once we've committed to the preview layout
  // we don't fall back to the planning pane on follow-up prompts.
  let showPreview = false;

  $: statusText = $isRunning ? "working…" : "idle";
  $: previewLoading = $isRunning;
  $: hasGeneratedApp = Object.keys($projectFiles).length > 0;
  $: if (hasGeneratedApp && !$isRunning) showPreview = true;

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
    if (!get(selectedModel)) return;
    sendPrompt(id, pending);
  };

  const bootstrapProject = async (id: string, pending: string) => {
    await Promise.all([
      loadHistory(id).catch(() => {}),
      loadProjectFiles(id).catch(() => {}),
      loadDesignTemplate(id).catch(() => {}),
      resumeTurn(id).catch(() => {}),
      get(providers).length === 0 ? loadProviders().catch(() => {}) : Promise.resolve(),
    ]);
    if (activeProjectId !== id) return;
    await consumePendingPrompt(id, pending);
  };

  $: if (projectId && projectId !== activeProjectId) {
    activeProjectId = projectId;
    projectName = "";
    showPreview = false;
    resetWorkspace();
    const pending = readPendingPrompt(projectId);
    bootstrapProject(projectId, pending);
    getProject(projectId)
      .then((p) => {
        if (activeProjectId !== projectId) return;
        if (!p) {
          goto("/projects", { replaceState: true });
          return;
        }
        projectName = p.name;
        projectIntegration.set(p.integrations?.supabase ?? null);
        projectVercel.set(p.integrations?.vercel ?? null);
        if (p.integrations?.vercel?.projectId) {
          checkVercelDeploymentStatus(projectId)
            .then((res) => {
              if (activeProjectId !== projectId) return;
              projectVercel.set(res?.integration ?? null);
            })
            .catch(() => {});
        }
      })
      .catch(() => {
        if (activeProjectId === projectId) {
          goto("/projects", { replaceState: true });
        }
      });
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
    style="left: {panelOpen
      ? showPreview
        ? 'min(444px, 100%)'
        : '70%'
      : '0px'};"
  >
    {#if showPreview}
      <PreviewHeader
        {panelOpen}
        {launcherHidden}
        supabaseConnected={$projectIntegration !== null}
        vercelDeployed={!!$projectVercel?.productionUrl}
        on:restart={() => sandpack?.refresh()}
        on:toggle-launcher={() => (launcherHidden = !launcherHidden)}
        on:open-supabase={() => (supabaseModalOpen = true)}
        on:open-deploy={() => (deployModalOpen = true)}
      />
      <div class="flex-1 min-h-0 relative">
        <SandpackPreview
          bind:this={sandpack}
          files={$assembledFiles}
          framed={panelOpen}
          loading={previewLoading}
        />
      </div>
    {:else}
      <div class="flex-1 min-h-0 p-3">
        <PlanningPane
          plan={$activePlan}
          todoStatuses={$todoStatuses}
          isRunning={$isRunning}
          planError={$planError}
          on:retry={() => retryLastPrompt(projectId)}
        />
      </div>
    {/if}
  </div>

  <AgentPanel
    open={panelOpen}
    wide={!showPreview}
    {projectId}
    {projectName}
    messages={$messages}
    isRunning={$isRunning}
    providers={$providers}
    selectedModel={$selectedModel}
    {statusText}
    plan={$activePlan}
    todoStatuses={$todoStatuses}
    planError={$planError}
    on:close={() => (panelOpen = false)}
    on:submit={handleSubmit}
    on:cancel={cancelAgent}
    on:retry={() => retryLastPrompt(projectId)}
    on:back={goBack}
    on:model-change={(e) => selectedModel.set(e.detail)}
  />

  <AgentLauncher
    hidden={panelOpen || launcherHidden || !showPreview}
    isRunning={$isRunning}
    plan={$activePlan}
    statuses={$todoStatuses}
    planError={$planError}
    on:open={openAgentPanel}
  />

  {#if supabaseModalOpen}
    <SupabaseConnectModal
      {projectId}
      integration={$projectIntegration}
      on:close={() => (supabaseModalOpen = false)}
      on:changed={(e) => projectIntegration.set(e.detail)}
    />
  {/if}

  {#if deployModalOpen}
    <DeployModal
      {projectId}
      vercel={$projectVercel}
      on:close={() => (deployModalOpen = false)}
      on:deployed={(e) => projectVercel.set(e.detail)}
    />
  {/if}
</div>

<style>
  .preview-shell {
    transition: left 300ms cubic-bezier(0.22, 0.8, 0.28, 1);
  }
</style>
