<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let step: "xs" | "sm" | "md" | "lg" | "xl";
  export let value: string;

  const PRESETS: Array<{ value: string; label: string }> = [
    { value: "2px", label: "2px" },
    { value: "4px", label: "4px · xs" },
    { value: "6px", label: "6px" },
    { value: "8px", label: "8px · sm" },
    { value: "12px", label: "12px" },
    { value: "16px", label: "16px · md" },
    { value: "20px", label: "20px" },
    { value: "24px", label: "24px · lg" },
    { value: "32px", label: "32px" },
    { value: "40px", label: "40px · xl" },
    { value: "48px", label: "48px" },
    { value: "64px", label: "64px" },
  ];

  const dispatch = createEventDispatcher<{ apply: string; close: void }>();

  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") dispatch("close");
  };

  const onPick = (v: string) => {
    if (v === value) {
      dispatch("close");
      return;
    }
    dispatch("apply", v);
  };
</script>

<svelte:window on:keydown={onKeydown} />

<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div
  class="popover"
  role="dialog"
  aria-label="Edit spacing {step}"
  on:click|stopPropagation
  on:keydown|stopPropagation
>
  <div class="pop-head">spacing.{step}</div>
  <ul class="pop-list" role="listbox">
    {#each PRESETS as preset}
      <li>
        <button
          type="button"
          class="pop-option"
          class:selected={preset.value === value}
          role="option"
          aria-selected={preset.value === value}
          on:click={() => onPick(preset.value)}
        >
          <span class="pop-bar" style="width: {preset.value};"></span>
          <span class="pop-label">{preset.label}</span>
          {#if preset.value === value}
            <span class="pop-check" aria-hidden="true">✓</span>
          {/if}
        </button>
      </li>
    {/each}
  </ul>
</div>

<style>
  .popover {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background-color: var(--bg-panel);
    box-shadow: 0 18px 40px -16px rgba(0, 0, 0, 0.5);
    min-width: 220px;
    max-height: 320px;
  }
  .pop-head {
    font-size: 10.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-tertiary);
    font-weight: 600;
    padding: 4px 8px 0;
  }
  .pop-list {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .pop-option {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 6px 8px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--text-primary);
    font-size: 12.5px;
    text-align: left;
    cursor: pointer;
    transition: background-color 120ms ease;
  }
  .pop-option:hover {
    background-color: var(--bg-tertiary);
  }
  .pop-option.selected {
    background-color: color-mix(in srgb, var(--accent) 14%, transparent);
    color: var(--accent);
  }
  .pop-bar {
    flex-shrink: 0;
    height: 6px;
    background-color: var(--accent);
    border-radius: 3px;
    min-width: 2px;
    max-width: 64px;
  }
  .pop-label {
    flex: 1;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11.5px;
  }
  .pop-check {
    color: var(--accent);
    font-weight: 700;
    font-size: 12px;
  }
</style>
