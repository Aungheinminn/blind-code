<script lang="ts">
  import { get } from "svelte/store";
  import { goto } from "$app/navigation";
  import PromptGenerator from "$lib/components/landing/PromptGenerator.svelte";
  import SampleBuilds from "$lib/components/landing/SampleBuilds.svelte";
  import { createProjectFromPrompt } from "$lib/api/projects";
  import { auth } from "$lib/stores/auth";
  import { selectedProvider, selectedModel } from "$lib/stores/agent";

  const PENDING_PROMPT_PREFIX = "vibe-pending-prompt:";

  let prompt = "";
  let busy = false;
  let error = "";

  const createFromPrompt = async (
    text: string,
    preset?: { name: string; description?: string },
  ) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    if (get(auth).status !== "authed") {
      try {
        sessionStorage.setItem("vibe-pending-landing-prompt", trimmed);
      } catch {}
      goto("/login");
      return;
    }

    const provider = get(selectedProvider);
    if (!provider) {
      error = "Pick a provider first.";
      return;
    }

    busy = true;
    error = "";
    try {
      const project = await createProjectFromPrompt({
        prompt: trimmed,
        provider,
        model: get(selectedModel) || undefined,
        ...(preset ? { name: preset.name, description: preset.description ?? "" } : {}),
      });
      try {
        sessionStorage.setItem(PENDING_PROMPT_PREFIX + project.id, trimmed);
      } catch {}
      goto(`/projects/${project.id}/workspace`);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      busy = false;
    }
  };

  const onSampleSelect = (
    e: CustomEvent<{ name: string; prompt: string; description?: string }>,
  ) => {
    createFromPrompt(e.detail.prompt, {
      name: e.detail.name,
      description: e.detail.description,
    });
  };
</script>

<svelte:head>
  <title>Blind Code — AI Coding Platform</title>
  <meta
    name="description"
    content="Describe the app you want to build. Watch the agent scaffold it with a live preview."
  />
</svelte:head>

<div
  class="w-full max-w-[900px] mx-auto px-6 pt-14 pb-20 flex flex-col gap-14"
  style="min-height: calc(100vh - 3.5rem);"
>
  <PromptGenerator bind:prompt {busy} {error} on:create={(e) => createFromPrompt(e.detail)} />
  <SampleBuilds on:select={onSampleSelect} />
</div>

{#if busy}
  <div
    class="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 loading-overlay"
    aria-live="polite"
    role="status"
  >
    <div class="loader-ring" aria-hidden="true"></div>
    <div class="flex flex-col items-center gap-1.5 text-center px-6">
      <span
        class="text-[16px] font-semibold tracking-tight"
        style="color: var(--text-primary);"
      >
        Naming your project…
      </span>
      <span class="text-[13px]" style="color: var(--text-secondary);">
        Hang tight, we're scaffolding your workspace.
      </span>
    </div>
  </div>
{/if}

<style>
  .loader-ring {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    border: 2.5px solid var(--border);
    border-top-color: var(--accent);
    animation: loader-spin 700ms linear infinite;
  }
  @keyframes loader-spin {
    to { transform: rotate(360deg); }
  }
  .loading-overlay {
    background-color: var(--chrome);
    backdrop-filter: blur(14px) saturate(140%);
    -webkit-backdrop-filter: blur(14px) saturate(140%);
  }
</style>
