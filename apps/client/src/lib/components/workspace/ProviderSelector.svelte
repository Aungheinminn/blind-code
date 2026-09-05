<script lang="ts">
  import type { ProviderInfo } from "$lib/stores/agent";

  export let providers: ProviderInfo[] = [];
  export let selectedProvider: string = "";
  export let selectedModel: string = "";
  export let modelPlaceholder: string = "";
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
  <input
    type="text"
    class="flex-1 min-w-0 h-[34px] rounded-[9px] border text-[12.5px] px-2.5 bg-transparent outline-none"
    style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-tertiary);"
    placeholder={modelPlaceholder}
    bind:value={selectedModel}
  />
</div>
