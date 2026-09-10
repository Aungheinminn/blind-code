<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let isRunning = false;
  export let statusText = "idle";

  let prompt = "";
  let focused = false;
  const dispatch = createEventDispatcher<{ submit: string; cancel: void }>();

  const submit = () => {
    const trimmed = prompt.trim();
    if (!trimmed || isRunning) return;
    dispatch("submit", trimmed);
    prompt = "";
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  $: canSend = prompt.trim().length > 0 && !isRunning;
</script>

<div class="px-4 pt-3 pb-3.5 border-t" style="border-color: var(--border);">
  <div
    class="flex items-end gap-2 rounded-2xl border px-3 pt-2 pb-2 composer-box"
    class:composer-focused={focused}
    style="border-color: {focused ? 'var(--accent)' : 'var(--border)'}; background-color: var(--bg-tertiary); box-shadow: var(--panel-shadow);"
  >
    <textarea
      class="flex-1 resize-none bg-transparent text-[14px] outline-none min-h-[26px] max-h-[140px] py-[3px] leading-[1.6]"
      style="color: var(--text-primary);"
      placeholder="Describe what you want to build…"
      rows="1"
      bind:value={prompt}
      on:keydown={handleKeydown}
      on:focus={() => (focused = true)}
      on:blur={() => (focused = false)}
    ></textarea>

    {#if isRunning}
      <button
        type="button"
        class="shrink-0 grid place-items-center w-8 h-8 rounded-[10px] border cursor-pointer stop-btn"
        style="border-color: var(--border); background-color: var(--bg-panel); color: var(--text-primary);"
        on:click={() => dispatch("cancel")}
        title="Stop"
        aria-label="Stop agent"
      >
        <span
          class="w-[10px] h-[10px] rounded-[3px]"
          style="background-color: currentColor;"
          aria-hidden="true"
        ></span>
      </button>
    {:else}
      <button
        type="button"
        class="shrink-0 grid place-items-center w-8 h-8 rounded-[10px] cursor-pointer send-btn disabled:cursor-not-allowed"
        style="background-color: var(--accent); color: white; opacity: {canSend ? 1 : 0.45};"
        on:click={submit}
        disabled={!canSend}
        aria-label="Send message"
        title="Send"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 19V5" />
          <path d="M5 12l7-7 7 7" />
        </svg>
      </button>
    {/if}
  </div>

  <div class="flex items-center gap-2.5 mt-2 px-0.5 text-[11px]" style="color: var(--text-tertiary);">
    <span>
      <b class="font-medium" style="color: var(--text-secondary);">↵</b> send
    </span>
    <span>
      <b class="font-medium" style="color: var(--text-secondary);">⇧↵</b> newline
    </span>
    <span class="flex-1"></span>
    <span class="truncate">{statusText}</span>
  </div>
</div>

<style>
  .send-btn {
    transition: transform 120ms ease, opacity 150ms ease;
    border: 0;
  }
  .send-btn:not(:disabled):hover {
    transform: translateY(-1px);
  }
  .stop-btn {
    transition: border-color 150ms ease, color 150ms ease;
  }
  .stop-btn:hover {
    border-color: var(--border-strong);
    color: var(--text-primary);
  }
</style>
