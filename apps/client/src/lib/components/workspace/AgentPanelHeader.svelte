<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let statusText = "idle";
  export let isRunning = false;

  const dispatch = createEventDispatcher<{ close: void; cancel: void; back: void }>();
</script>

<div class="flex items-center gap-3 px-[18px] pt-[18px] pb-[14px]">
  <button
    type="button"
    class="w-[30px] h-[30px] rounded-[9px] border flex items-center justify-center cursor-pointer transition-colors"
    style="border-color: var(--border); background-color: var(--bg-tertiary); color: var(--text-secondary);"
    on:click={() => dispatch("back")}
    aria-label="Go back"
    title="Back"
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  </button>
  <div
    class="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center text-[11.5px] font-bold text-white"
    style="background-color: var(--accent);"
  >
    BC
  </div>
  <div class="flex flex-col gap-0.5 flex-1 min-w-0">
    <span class="text-sm font-semibold tracking-tight" style="color: var(--text-primary);">
      Projects
    </span>
    <span class="text-[11.5px] truncate" style="color: var(--text-secondary);">
      Agent — {statusText}
    </span>
  </div>
  {#if isRunning}
    <button
      type="button"
      class="h-[30px] px-2.5 rounded-[9px] border text-[11px] font-medium cursor-pointer transition-colors"
      style="border-color: var(--border); background-color: var(--bg-tertiary); color: var(--text-secondary);"
      on:click={() => dispatch("cancel")}
      title="Cancel current turn"
    >
      Cancel
    </button>
  {/if}
  <button
    type="button"
    class="w-[30px] h-[30px] rounded-[9px] border flex items-center justify-center cursor-pointer transition-colors"
    style="border-color: var(--border); background-color: var(--bg-tertiary); color: var(--text-secondary);"
    on:click={() => dispatch("close")}
    aria-label="Close agent panel"
    title="Close panel"
  >
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <path d="M16 15l-3-3 3-3" />
    </svg>
  </button>
</div>
