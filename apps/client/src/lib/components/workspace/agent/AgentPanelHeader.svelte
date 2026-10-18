<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import chevronLeftIcon from "$lib/assets/icons/chevron-left.svg?raw";
  import settingsGearIcon from "$lib/assets/icons/settings-gear.svg?raw";
  import panelSideIcon from "$lib/assets/icons/panel-side.svg?raw";

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
    <span class="icon-15">{@html chevronLeftIcon}</span>
  </button>

  <div
    class="grid place-items-center w-[30px] h-[30px] rounded-[9px] text-[11px] font-semibold text-white"
    style="background: linear-gradient(180deg, var(--accent), var(--accent-hover)); letter-spacing: 0.02em;"
  >
    BC
  </div>

  <div class="flex-1 min-w-0">
    <span class="text-sm font-semibold tracking-tight truncate block" style="color: var(--text-primary);">
      {displayName}
    </span>
  </div>

  <a
    href={settingsHref}
    class="grid place-items-center w-[30px] h-[30px] rounded-lg border cursor-pointer transition-colors hover-ghost no-underline"
    style="border-color: transparent; color: var(--text-secondary);"
    aria-label="Project settings"
    title="Project settings"
  >
    <span class="icon-15">{@html settingsGearIcon}</span>
  </a>

  <button
    type="button"
    class="grid place-items-center w-[30px] h-[30px] rounded-lg border cursor-pointer transition-colors hover-outline"
    style="border-color: var(--border); background-color: var(--bg-tertiary); color: var(--text-secondary);"
    on:click={() => dispatch("close")}
    aria-label="Close agent panel"
    title="Close panel"
  >
    <span class="icon-14">{@html panelSideIcon}</span>
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
  .icon-14 {
    display: inline-flex;
    width: 14px;
    height: 14px;
  }
  .icon-15 {
    display: inline-flex;
    width: 15px;
    height: 15px;
  }
</style>
