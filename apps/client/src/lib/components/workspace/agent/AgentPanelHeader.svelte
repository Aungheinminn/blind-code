<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let statusText = "idle";
  export let projectId = "";
  export let projectName = "";

  const dispatch = createEventDispatcher<{ close: void; back: void }>();

  $: settingsHref = projectId ? `/projects/${projectId}` : "#";
  $: displayName = projectName || "Project";
</script>

<div class="flex items-center gap-2.5 px-4 pt-3.5 pb-3">
  <button
    type="button"
    class="grid place-items-center w-[30px] h-[30px] rounded-lg border border-transparent bg-transparent cursor-pointer transition-colors hover-ghost"
    style="color: var(--text-secondary);"
    on:click={() => dispatch("back")}
    aria-label="Go back"
    title="Back"
  >
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  </button>

  <div
    class="grid place-items-center w-[30px] h-[30px] rounded-[9px] text-[11px] font-semibold text-white"
    style="background: linear-gradient(180deg, var(--accent), var(--accent-hover)); letter-spacing: 0.02em;"
  >
    BC
  </div>

  <div class="flex flex-col gap-0.5 flex-1 min-w-0">
    <a
      href={settingsHref}
      class="text-sm font-semibold tracking-tight truncate no-underline project-name"
      style="color: var(--text-primary);"
      title="Project settings"
    >
      {displayName}
    </a>
    <span class="flex items-center gap-1.5 text-[11.5px] truncate" style="color: var(--text-tertiary);">
      <span
        class="w-[6px] h-[6px] rounded-full animate-pulse shrink-0"
        style="background-color: var(--accent);"
        aria-hidden="true"
      ></span>
      <span class="truncate">Agent — {statusText}</span>
    </span>
  </div>

  <a
    href={settingsHref}
    class="grid place-items-center w-[30px] h-[30px] rounded-lg border cursor-pointer transition-colors hover-ghost no-underline"
    style="border-color: transparent; color: var(--text-secondary);"
    aria-label="Project settings"
    title="Project settings"
  >
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  </a>

  <button
    type="button"
    class="grid place-items-center w-[30px] h-[30px] rounded-lg border cursor-pointer transition-colors hover-outline"
    style="border-color: var(--border); background-color: var(--bg-tertiary); color: var(--text-secondary);"
    on:click={() => dispatch("close")}
    aria-label="Close agent panel"
    title="Close panel"
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </svg>
  </button>
</div>

<style>
  .hover-ghost:hover {
    background-color: var(--bg-tertiary);
    color: var(--text-primary);
  }
  .hover-outline:hover {
    color: var(--text-primary);
    border-color: var(--border-strong);
  }
  .project-name:hover {
    color: var(--accent);
  }
</style>
