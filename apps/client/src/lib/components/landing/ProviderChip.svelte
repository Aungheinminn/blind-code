<script lang="ts">
  import {
    providers,
    selectedProvider,
    selectedModel,
    loadProviders,
  } from "$lib/stores/agent";
  import { catalog, enabledModels } from "$lib/stores/connect";
  import { auth } from "$lib/stores/auth";

  let loaded = false;

  $: if ($auth.status === "authed" && !loaded) {
    loaded = true;
    loadProviders();
  }

  $: enabledForProvider = $enabledModels[$selectedProvider] ?? [];
  $: catalogForProvider = $catalog[$selectedProvider] ?? [];
  $: labelFor = (id: string) =>
    catalogForProvider.find((m) => m.id === id)?.label ?? id;
  $: currentProviderConfigured =
    $providers.find((p) => p.name === $selectedProvider)?.configured ?? false;

  $: if (
    $selectedProvider &&
    enabledForProvider.length > 0 &&
    !enabledForProvider.includes($selectedModel)
  ) {
    selectedModel.set(enabledForProvider[0]);
  }
</script>

{#if $auth.status === "authed"}
  <div class="flex items-center gap-1.5">
    <div
      class="pill relative"
      style="border-color: var(--border); background-color: var(--bg-secondary);"
    >
      <span
        class="w-[6px] h-[6px] rounded-full shrink-0"
        style="background-color: {currentProviderConfigured
          ? 'var(--success)'
          : 'var(--text-tertiary)'};"
        aria-hidden="true"
      ></span>
      <select
        class="pill-select"
        style="color: var(--text-secondary);"
        bind:value={$selectedProvider}
        aria-label="Provider"
      >
        {#each $providers as p (p.name)}
          <option value={p.name} disabled={!p.configured}>
            {p.name}{p.configured ? "" : " (no key)"}
          </option>
        {/each}
      </select>
      <svg
        class="shrink-0 pointer-events-none"
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
        style="color: var(--text-tertiary);"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>

    {#if enabledForProvider.length > 0}
      <div
        class="pill relative"
        style="border-color: var(--border); background-color: var(--bg-secondary);"
      >
        <select
          class="pill-select"
          style="color: var(--text-secondary);"
          bind:value={$selectedModel}
          aria-label="Model"
        >
          {#each enabledForProvider as id (id)}
            <option value={id}>{labelFor(id)}</option>
          {/each}
        </select>
        <svg
          class="shrink-0 pointer-events-none"
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
          style="color: var(--text-tertiary);"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
    {:else}
      <a
        href="/settings/connect?tab=models"
        class="pill no-underline"
        style="border-color: var(--border); background-color: var(--bg-secondary); color: var(--text-secondary);"
      >
        <span>Pick models →</span>
      </a>
    {/if}
  </div>
{/if}

<style>
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 9px;
    border-radius: 8px;
    border-width: 1px;
    border-style: solid;
    font-size: 12px;
    cursor: pointer;
    transition: color 150ms ease, border-color 150ms ease;
  }
  .pill:hover {
    color: var(--text-primary);
    border-color: var(--border-strong);
  }
  .pill-select {
    appearance: none;
    -webkit-appearance: none;
    background: transparent;
    border: 0;
    outline: none;
    font-family: inherit;
    font-size: 12px;
    color: inherit;
    cursor: pointer;
    padding: 0;
    max-width: 140px;
    text-overflow: ellipsis;
    overflow: hidden;
  }
</style>
