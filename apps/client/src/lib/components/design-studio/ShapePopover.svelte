<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let step: "sm" | "md" | "lg" | "full";
  export let value: string;

  const PRESETS: Array<{ value: string; label: string }> = [
    { value: "0px", label: "0px · sharp" },
    { value: "2px", label: "2px" },
    { value: "4px", label: "4px · xs" },
    { value: "6px", label: "6px" },
    { value: "8px", label: "8px · sm" },
    { value: "10px", label: "10px" },
    { value: "12px", label: "12px · md" },
    { value: "14px", label: "14px · lg" },
    { value: "16px", label: "16px" },
    { value: "20px", label: "20px" },
    { value: "24px", label: "24px · xl" },
    { value: "9999px", label: "9999px · pill" },
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

<div
  class="popover"
  role="dialog"
  aria-label="Edit radius {step}"
  on:click|stopPropagation
  on:keydown|stopPropagation
>
  <div class="pop-head">rounded.{step}</div>
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
          <span
            class="pop-swatch"
            style="border-radius: {preset.value};"
          ></span>
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
    min-width: 200px;
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
  .pop-swatch {
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    background-color: var(--accent);
    border: 1px solid var(--border);
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
