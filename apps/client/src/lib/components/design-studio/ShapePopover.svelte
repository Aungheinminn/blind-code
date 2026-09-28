<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";

  export let step: "sm" | "md" | "lg" | "full";
  export let value: string;

  let inputValue = value;
  let rootEl: HTMLDivElement | null = null;

  const dispatch = createEventDispatcher<{ apply: string; close: void }>();

  const onApply = () => {
    const v = inputValue.trim();
    if (!v) return;
    dispatch("apply", v);
  };

  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") dispatch("close");
    if (e.key === "Enter") onApply();
  };

  onMount(() => {
    const input = rootEl?.querySelector("input") as HTMLInputElement | null;
    input?.focus();
    input?.select();
  });
</script>

<svelte:window on:keydown={onKeydown} />

<div
  class="popover"
  bind:this={rootEl}
  role="dialog"
  aria-label="Edit radius {step}"
  on:click|stopPropagation
  on:keydown|stopPropagation
>
  <div class="pop-head">rounded.{step}</div>
  <input
    type="text"
    bind:value={inputValue}
    placeholder="4px"
    spellcheck="false"
    class="pop-input"
  />
  <div class="pop-actions">
    <button type="button" class="pop-btn pop-btn-ghost" on:click={() => dispatch("close")}>
      Cancel
    </button>
    <button type="button" class="pop-btn pop-btn-primary" on:click={onApply}>
      Apply
    </button>
  </div>
</div>

<style>
  .popover {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background-color: var(--bg-panel);
    box-shadow: 0 18px 40px -16px rgba(0, 0, 0, 0.5);
    min-width: 180px;
  }
  .pop-head {
    font-size: 10.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-tertiary);
    font-weight: 600;
  }
  .pop-input {
    padding: 7px 10px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12.5px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background-color: var(--bg-secondary);
    color: var(--text-primary);
    outline: none;
  }
  .pop-input:focus {
    border-color: var(--accent);
  }
  .pop-actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
  }
  .pop-btn {
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid var(--border);
    transition: background-color 150ms ease, filter 150ms ease;
  }
  .pop-btn-ghost {
    background: transparent;
    color: var(--text-secondary);
  }
  .pop-btn-ghost:hover {
    background-color: var(--bg-tertiary);
    color: var(--text-primary);
  }
  .pop-btn-primary {
    background-color: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }
  .pop-btn-primary:hover {
    filter: brightness(1.05);
  }
</style>
