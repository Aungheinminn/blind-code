<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let statusText = "idle";
  export let isRunning = false;

  const dispatch = createEventDispatcher<{ close: void; cancel: void }>();
</script>

<div class="flex items-center gap-3 px-[18px] pt-[18px] pb-[14px]">
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
      stroke-width="2.2"
      stroke-linecap="round"
    >
      <path d="M15 6l-6 6 6 6" />
    </svg>
  </button>
</div>
