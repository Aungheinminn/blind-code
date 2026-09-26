<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import { TIER_MODELS, TIER_ORDER, type TierModel } from "$lib/tierModels";
  import type { ProviderInfo } from "$lib/stores/agent";

  export let value: string = "";
  export let providers: ProviderInfo[] = [];
  export let placement: "up" | "down" = "up";
  export let disabled = false;

  const dispatch = createEventDispatcher<{ change: string }>();

  let open = false;
  let wrap: HTMLDivElement | undefined;

  $: configured = new Set(providers.filter((p) => p.configured).map((p) => p.name));
  $: selected = TIER_MODELS.find((m) => m.id === value) ?? null;
  $: grouped = TIER_ORDER.map((tier) => ({
    tier,
    label: tier === "low" ? "Low" : tier === "medium" ? "Medium" : "High",
    models: TIER_MODELS.filter((m) => m.tier === tier),
  }));

  const pick = (m: TierModel) => {
    if (!configured.has(m.provider)) return;
    if (m.id !== value) dispatch("change", m.id);
    open = false;
  };

  const toggle = () => {
    if (disabled) return;
    open = !open;
  };

  const onDocClick = (e: MouseEvent) => {
    if (!open || !wrap) return;
    if (!wrap.contains(e.target as Node)) open = false;
  };

  const onKey = (e: KeyboardEvent) => {
    if (!open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      open = false;
    }
  };

  onMount(() => {
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  });
</script>

<div class="wrap" bind:this={wrap}>
  <button
    type="button"
    class="trigger"
    class:trigger--open={open}
    on:click={toggle}
    {disabled}
    aria-haspopup="listbox"
    aria-expanded={open}
  >
    <span class="truncate">
      {selected ? selected.label : "Pick a model"}
    </span>
    <svg
      class="chev"
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      aria-hidden="true"
      style="transform: rotate({open ? 180 : 0}deg);"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  </button>

  {#if open}
    <div
      class="menu"
      class:menu--up={placement === "up"}
      class:menu--down={placement === "down"}
      role="listbox"
    >
      {#each grouped as g (g.tier)}
        <div class="section-label">{g.label}</div>
        {#each g.models as m (m.id)}
          {@const isConfigured = configured.has(m.provider)}
          {@const isActive = m.id === value}
          <button
            type="button"
            role="option"
            aria-selected={isActive}
            class="row"
            class:row--active={isActive}
            class:row--disabled={!isConfigured}
            disabled={!isConfigured}
            on:click={() => pick(m)}
            title={isConfigured ? "" : `Add a ${m.provider} key in Settings`}
          >
            <span class="row-label truncate">{m.label}</span>
            {#if !isConfigured}
              <span class="hint">no key</span>
            {/if}
          </button>
        {/each}
      {/each}
    </div>
  {/if}
</div>

<style>
  .wrap {
    position: relative;
    display: inline-block;
    min-width: 0;
  }
  .trigger {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 9px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background-color: var(--bg-tertiary);
    color: var(--text-secondary);
    font-size: 12px;
    font-family: inherit;
    cursor: pointer;
    outline: none;
    transition:
      color 150ms ease,
      border-color 150ms ease,
      background-color 150ms ease;
    max-width: 200px;
  }
  .trigger:hover:not(:disabled),
  .trigger--open {
    color: var(--text-primary);
    border-color: var(--border-strong);
  }
  .trigger:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .chev {
    color: var(--text-tertiary);
    flex-shrink: 0;
    transition: transform 150ms ease;
  }
  .truncate {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .menu {
    position: absolute;
    right: 0;
    min-width: 220px;
    padding: 6px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background-color: var(--bg-panel);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
    z-index: 40;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .menu--up {
    bottom: calc(100% + 6px);
  }
  .menu--down {
    top: calc(100% + 6px);
  }
  .section-label {
    padding: 6px 8px 2px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-tertiary);
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 7px 8px;
    border: 0;
    background: transparent;
    color: var(--text-secondary);
    font-family: inherit;
    font-size: 12.5px;
    text-align: left;
    border-radius: 6px;
    cursor: pointer;
  }
  .row:hover:not(:disabled) {
    background-color: var(--bg-tertiary);
    color: var(--text-primary);
  }
  .row--active {
    background-color: var(--bg-tertiary);
    color: var(--text-primary);
  }
  .row--disabled {
    color: var(--text-tertiary);
    cursor: not-allowed;
  }
  .row-label {
    flex: 1;
    min-width: 0;
  }
  .hint {
    font-size: 10.5px;
    color: var(--text-tertiary);
    flex-shrink: 0;
  }
</style>
