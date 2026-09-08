<script lang="ts">
  import type { ProviderInfo } from "$lib/stores/agent";
  import { catalog, enabledModels } from "$lib/stores/connect";

  export let providers: ProviderInfo[] = [];
  export let selectedProvider: string = "";
  export let selectedModel: string = "";
  export let modelPlaceholder: string = "";

  $: enabledForProvider = $enabledModels[selectedProvider] ?? [];
  $: catalogForProvider = $catalog[selectedProvider] ?? [];
  $: labelFor = (id: string) =>
    catalogForProvider.find((m) => m.id === id)?.label ?? id;

  $: if (
    selectedProvider &&
    enabledForProvider.length > 0 &&
    !enabledForProvider.includes(selectedModel)
  ) {
    selectedModel = enabledForProvider[0];
  }
</script>

<div class="flex gap-2 px-[18px] pb-[14px] border-b" style="border-color: var(--border);">
  <select
    class="flex-1 min-w-0 h-[34px] rounded-[9px] border text-[12.5px] px-2.5 bg-transparent outline-none cursor-pointer"
    style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-tertiary);"
    bind:value={selectedProvider}
  >
    {#each providers as p (p.name)}
      <option value={p.name} disabled={!p.configured}>
        {p.name}{p.configured ? "" : " (no key)"}
      </option>
    {/each}
  </select>

  {#if enabledForProvider.length > 0}
    <select
      class="flex-1 min-w-0 h-[34px] rounded-[9px] border text-[12.5px] px-2.5 bg-transparent outline-none cursor-pointer"
      style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-tertiary);"
      bind:value={selectedModel}
    >
      {#each enabledForProvider as id (id)}
        <option value={id}>{labelFor(id)}</option>
      {/each}
    </select>
  {:else}
    <a
      href="/settings/connect?tab=models"
      class="flex-1 min-w-0 h-[34px] rounded-[9px] border text-[12.5px] px-2.5 no-underline flex items-center justify-center"
      style="border-color: var(--border); color: var(--text-secondary); background-color: var(--bg-tertiary);"
      title={modelPlaceholder ? `default: ${modelPlaceholder}` : ""}
    >
      Pick models →
    </a>
  {/if}
</div>
