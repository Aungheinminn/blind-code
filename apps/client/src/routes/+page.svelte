<script lang="ts">
  import { get } from "svelte/store";
  import { goto } from "$app/navigation";
  import PromptGenerator from "$lib/components/landing/PromptGenerator.svelte";
  import SampleBuilds from "$lib/components/landing/SampleBuilds.svelte";
  import FullPageLoader from "$lib/components/FullPageLoader.svelte";
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

    if (!preset) busy = true;
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
      if (!preset) busy = false;
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
  <FullPageLoader
    title="Naming your project…"
    subtitle="Hang tight, we're scaffolding your workspace."
  />
{/if}
