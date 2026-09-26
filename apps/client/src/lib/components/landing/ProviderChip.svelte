<script lang="ts">
  import { providers, selectedModel, loadProviders } from "$lib/stores/agent";
  import { auth } from "$lib/stores/auth";
  import ModelDropdown from "$lib/components/workspace/agent/ModelDropdown.svelte";

  let loaded = false;

  $: if ($auth.status === "authed" && !loaded) {
    loaded = true;
    loadProviders();
  }
</script>

{#if $auth.status === "authed"}
  <ModelDropdown
    value={$selectedModel}
    providers={$providers}
    placement="down"
    on:change={(e) => selectedModel.set(e.detail)}
  />
{/if}
