<script lang="ts">
  import {
    currentHeight,
    currentWidth,
    orientation,
    selectedDevice,
    type DeviceKey,
    type Orientation,
  } from "$lib/stores/preview";

  type Item = { key: DeviceKey; title: string };

  const items: Item[] = [
    { key: "full", title: "Full width" },
    { key: "mobile", title: "Mobile — 390 × 844" },
    { key: "tablet", title: "Tablet — 834 × 1112" },
    { key: "laptop", title: "Laptop — 1440 × 900" },
  ];

  const pick = (key: DeviceKey) => selectedDevice.set(key);
  const rotate = () =>
    orientation.update((v: Orientation): Orientation =>
      v === "portrait" ? "landscape" : "portrait",
    );

  $: w = currentWidth($selectedDevice, $orientation);
  $: h = currentHeight($selectedDevice, $orientation);
  $: label = w === null ? "Full" : `${w} × ${h}`;
  $: canRotate = $selectedDevice === "mobile" || $selectedDevice === "tablet";
  $: chipDevice = $selectedDevice === "full" ? "mobile" : $selectedDevice;
</script>

<div
  class="device-pill flex items-center gap-[2px]"
  role="group"
  aria-label="Preview width"
  style="padding: 3px; background-color: var(--chrome); border: 1px solid var(--chrome-border); border-radius: 10px; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);"
>
  {#each items as item (item.key)}
    {@const active = $selectedDevice === item.key}
    <button
      type="button"
      class="device-btn"
      class:active
      title={item.title}
      aria-label={item.title}
      aria-pressed={active}
      on:click={() => pick(item.key)}
    >
      {#if item.key === "full"}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="9 4 4 4 4 9" />
          <polyline points="15 4 20 4 20 9" />
          <polyline points="9 20 4 20 4 15" />
          <polyline points="15 20 20 20 20 15" />
        </svg>
      {:else if item.key === "mobile"}
        <svg width="11" height="17" viewBox="0 0 11 17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="1" y="1" width="9" height="15" rx="1.8" />
          <line x1="4.5" y1="13.5" x2="6.5" y2="13.5" />
        </svg>
      {:else if item.key === "tablet"}
        <svg width="17" height="19" viewBox="0 0 17 19" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="1" y="1.5" width="15" height="16" rx="1.8" />
          <circle cx="8.5" cy="14.6" r="0.95" fill="currentColor" stroke="none" />
        </svg>
      {:else}
        <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="2" y="1" width="16" height="10" rx="1.4" />
          <line x1="0.5" y1="13" x2="19.5" y2="13" />
        </svg>
      {/if}
    </button>
  {/each}

  <span class="separator" aria-hidden="true"></span>

  <button
    type="button"
    class="rotate-chip"
    class:rotated={canRotate && $orientation === "landscape"}
    title={canRotate ? "Rotate orientation" : "Rotate not available for this device"}
    aria-label="Rotate orientation"
    aria-pressed={canRotate && $orientation === "landscape"}
    disabled={!canRotate}
    on:click={rotate}
  >
    <span class="rot-icon" aria-hidden="true">
      {#if chipDevice === "mobile"}
        <svg width="12" height="16" viewBox="0 0 12 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <rect x="1" y="1" width="10" height="14" rx="1.8" />
          <line x1="5" y1="12.5" x2="7" y2="12.5" />
        </svg>
      {:else if chipDevice === "tablet"}
        <svg width="15" height="17" viewBox="0 0 15 17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <rect x="1" y="1" width="13" height="15" rx="1.8" />
          <line x1="6.5" y1="13.5" x2="8.5" y2="13.5" />
        </svg>
      {:else}
        <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="1" width="16" height="10" rx="1.4" />
          <line x1="0.5" y1="13" x2="19.5" y2="13" />
        </svg>
      {/if}
    </span>
    <span class="dims">{label}</span>
  </button>
</div>

<style>
  .device-btn {
    width: 32px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    transition: background 150ms ease, color 150ms ease, opacity 150ms ease;
  }
  .device-btn:hover:not(.active):not(:disabled) {
    background: var(--chrome-hover);
    color: var(--text-primary);
  }
  .device-btn.active {
    background: var(--accent);
    color: #ffffff;
  }
  .device-btn:disabled {
    cursor: default;
    opacity: 0.55;
  }
  .separator {
    width: 1px;
    height: 18px;
    margin: 0 4px;
    background: var(--chrome-border);
  }
  .rotate-chip {
    height: 28px;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 0 9px;
    border: 1px solid transparent;
    border-radius: 7px;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    transition:
      background 180ms ease,
      color 180ms ease,
      border-color 180ms ease,
      opacity 180ms ease;
  }
  .rotate-chip:hover:not(:disabled) {
    background: var(--chrome-hover);
    color: var(--text-primary);
  }
  .rotate-chip:disabled {
    cursor: default;
    opacity: 0.45;
  }
  .rotate-chip.rotated {
    background: color-mix(in oklab, var(--accent) 14%, transparent);
    border-color: var(--accent);
    color: var(--accent);
  }
  .rot-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 18px;
    transform: rotate(0deg);
    transition: transform 320ms cubic-bezier(0.22, 0.8, 0.28, 1);
  }
  .rotate-chip.rotated .rot-icon {
    transform: rotate(-90deg);
  }
  .rotate-chip .dims {
    display: inline-block;
    min-width: 92px;
    text-align: left;
    font-family: ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace;
    font-size: 10.5px;
    letter-spacing: 0.01em;
    font-variant-numeric: tabular-nums;
  }
</style>
