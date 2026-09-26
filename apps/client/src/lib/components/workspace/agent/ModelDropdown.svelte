<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import Dropdown from "$lib/components/ui/Dropdown.svelte";
  import { TIER_MODELS, TIER_ORDER, type TierModel } from "$lib/tierModels";
  import type { ProviderInfo } from "$lib/stores/agent";

  export let value: string = "";
  export let providers: ProviderInfo[] = [];
  export let placement: "up" | "down" = "up";
  export let disabled = false;

  const dispatch = createEventDispatcher<{ change: string }>();

  $: configured = new Set(providers.filter((p) => p.configured).map((p) => p.name));
  $: selected = TIER_MODELS.find((m) => m.id === value) ?? null;
  $: grouped = TIER_ORDER.map((tier) => ({
    tier,
    label: tier === "low" ? "Low" : tier === "medium" ? "Medium" : "High",
    models: TIER_MODELS.filter((m) => m.tier === tier),
  }));

  const pick = (m: TierModel, close: () => void) => {
    if (!configured.has(m.provider)) return;
    if (m.id !== value) dispatch("change", m.id);
    close();
  };
</script>

<Dropdown {placement} {disabled} menuMinWidth={220}>
  <button
    slot="trigger"
    let:open
    let:toggle
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

  <svelte:fragment let:close>
    {#each grouped as g (g.tier)}
      <div class="dropdown-section-label">{g.label}</div>
      {#each g.models as m (m.id)}
        {@const isConfigured = configured.has(m.provider)}
        {@const isActive = m.id === value}
        <button
          type="button"
          role="option"
          aria-selected={isActive}
          class="dropdown-row"
          class:dropdown-row--active={isActive}
          class:dropdown-row--disabled={!isConfigured}
          disabled={!isConfigured}
          on:click={() => pick(m, close)}
          title={isConfigured ? "" : `Add a ${m.provider} key in Settings`}
        >
          <span class="dropdown-row-label">{m.label}</span>
          {#if !isConfigured}
            <span class="dropdown-row-hint">no key</span>
          {/if}
        </button>
      {/each}
    {/each}
  </svelte:fragment>
</Dropdown>

<style>
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
</style>
