<script lang="ts">
  import { get } from "svelte/store";
  import { goto } from "$app/navigation";
  import ProviderChip from "./ProviderChip.svelte";
  import { createProjectFromPrompt } from "$lib/api/projects";
  import { auth } from "$lib/stores/auth";
  import { selectedProvider, selectedModel } from "$lib/stores/agent";

  const PENDING_PROMPT_PREFIX = "vibe-pending-prompt:";

  let prompt = "";
  let busy = false;
  let error = "";

  const suggestions = [
    "Habit tracker with streaks",
    "Team standup board",
    "Recipe finder",
  ];

  $: hintText = error
    ? error
    : prompt.trim()
      ? `${prompt.trim().length} characters`
      : "";
  $: canCreate = prompt.trim().length > 0 && !busy;

  const applySuggestion = (label: string) => {
    prompt = label;
  };

  const onCreate = async () => {
    if (!canCreate) return;
    const text = prompt.trim();

    if (get(auth).status !== "authed") {
      try {
        sessionStorage.setItem("vibe-pending-landing-prompt", text);
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
        prompt: text,
        provider,
        model: get(selectedModel) || undefined,
      });
      try {
        sessionStorage.setItem(PENDING_PROMPT_PREFIX + project.id, text);
      } catch {}
      goto(`/projects/${project.id}/workspace`);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      busy = false;
    }
  };
</script>

<section class="flex flex-col gap-4">
  <div
    class="rounded-2xl border p-4 flex flex-col gap-3"
    style="border-color: var(--border); background-color: var(--bg-panel); box-shadow: 0 20px 50px -30px rgba(0, 0, 0, 0.9);"
  >
    <textarea
      rows="4"
      bind:value={prompt}
      placeholder="Describe the app you want to build…"
      class="w-full resize-y min-h-24 bg-transparent border-0 outline-none text-base leading-[1.55] px-1 pt-1"
      style="color: var(--text-primary);"
    ></textarea>

    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-3 flex-wrap min-w-0">
        <ProviderChip />
        {#if hintText}
          <span
            class="text-[12.5px] truncate"
            style="color: {error ? '#ef4444' : 'var(--text-tertiary)'};"
          >
            {hintText}
          </span>
        {/if}
      </div>
      <div class="flex items-center gap-2.5">
        <a
          href="/projects"
          class="px-[18px] py-2.5 rounded-[10px] border no-underline text-[14.5px] font-medium view-projects-btn"
          style="border-color: var(--border); color: var(--text-secondary);"
        >
          View Projects
        </a>
        <button
          type="button"
          on:click={onCreate}
          disabled={!canCreate}
          class="px-[22px] py-[11px] rounded-[10px] border-0 text-[14.5px] font-semibold text-white create-btn"
          style="background-color: {canCreate ? 'var(--accent)' : 'var(--bg-tertiary)'}; color: {canCreate ? '#ffffff' : 'var(--text-tertiary)'}; cursor: {canCreate ? 'pointer' : 'not-allowed'};"
        >
          Create
        </button>
      </div>
    </div>
  </div>

  <div class="flex gap-2 flex-wrap justify-center">
    {#each suggestions as label}
      <button
        type="button"
        on:click={() => applySuggestion(label)}
        class="px-[13px] py-[7px] rounded-full border text-[13px] cursor-pointer chip"
        style="background-color: var(--bg-secondary); border-color: var(--border); color: var(--text-secondary);"
      >
        {label}
      </button>
    {/each}
  </div>
</section>

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
  .view-projects-btn {
    transition: background-color 150ms ease, color 150ms ease, border-color 150ms ease;
  }
  .view-projects-btn:hover {
    background-color: var(--bg-tertiary);
    color: var(--text-primary);
    border-color: var(--border-strong);
  }
  .create-btn {
    transition: background-color 150ms ease;
  }
  .create-btn:not(:disabled):hover {
    background-color: var(--accent-hover) !important;
  }
  .chip {
    transition: color 150ms ease, border-color 150ms ease;
  }
  .chip:hover {
    color: var(--text-primary);
    border-color: var(--border-strong);
  }
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
