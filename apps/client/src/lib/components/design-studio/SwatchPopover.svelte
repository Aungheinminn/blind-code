<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";

  export let name: string;
  export let value: string;

  let hex = value;

  const dispatch = createEventDispatcher<{ apply: string; close: void }>();

  const normalizeHex = (raw: string): string | null => {
    const v = raw.trim().replace(/^#?/, "#");
    if (/^#[0-9a-fA-F]{3}$/.test(v)) return v.toUpperCase();
    if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toUpperCase();
    if (/^#[0-9a-fA-F]{8}$/.test(v)) return v.toUpperCase();
    return null;
  };

  const onColorInput = (e: Event) => {
    const v = (e.target as HTMLInputElement).value;
    const norm = normalizeHex(v);
    if (norm) hex = norm;
  };

  const onApply = () => {
    const norm = normalizeHex(hex);
    if (!norm) return;
    dispatch("apply", norm);
  };

  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") dispatch("close");
    if (e.key === "Enter") onApply();
  };

  let rootEl: HTMLDivElement | null = null;

  onMount(() => {
    const input = rootEl?.querySelector("input[type=text]") as HTMLInputElement | null;
    input?.focus();
    input?.select();
  });

  $: colorInputValue = normalizeHex(hex) ?? "#000000";
</script>

<svelte:window on:keydown={onKeydown} />

<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div
  class="popover"
  bind:this={rootEl}
  role="dialog"
  aria-label="Edit color {name}"
  on:click|stopPropagation
  on:keydown|stopPropagation
>
  <div class="pop-head">
    <span class="pop-role">{name}</span>
  </div>
  <div class="pop-row">
    <input
      type="color"
      value={colorInputValue}
      on:input={onColorInput}
      aria-label="Color picker"
      class="pop-color"
    />
    <input
      type="text"
      bind:value={hex}
      class="pop-hex"
      placeholder="#RRGGBB"
      spellcheck="false"
    />
  </div>
  <div class="pop-actions">
    <button type="button" class="pop-btn pop-btn-ghost" on:click={() => dispatch("close")}>
      Cancel
    </button>
    <button
      type="button"
      class="pop-btn pop-btn-primary"
      on:click={onApply}
      disabled={!normalizeHex(hex)}
    >
      Apply
    </button>
  </div>
</div>

<style>
  .popover {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background-color: var(--bg-panel);
    box-shadow: 0 18px 40px -16px rgba(0, 0, 0, 0.5);
    min-width: 220px;
  }
  .pop-head {
    font-size: 10.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-tertiary);
  }
  .pop-role {
    font-weight: 600;
    color: var(--text-primary);
  }
  .pop-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .pop-color {
    width: 42px;
    height: 34px;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
  }
  .pop-hex {
    flex: 1;
    padding: 7px 10px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12.5px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background-color: var(--bg-secondary);
    color: var(--text-primary);
    outline: none;
  }
  .pop-hex:focus {
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
    transition: background-color 150ms ease, filter 150ms ease, opacity 150ms ease;
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
  .pop-btn-primary:hover:not(:disabled) {
    filter: brightness(1.05);
  }
  .pop-btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
